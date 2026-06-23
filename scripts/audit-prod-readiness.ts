#!/usr/bin/env tsx
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { extractBrowserSupabaseContext, supabaseContextMismatchIssue, type BrowserSupabaseContext } from '../src/lib/prod-audit-context'
import { auditProdReadiness, formatProdReadinessIssue, summarizeProdReadinessIssues, sortProdReadinessIssues, type ProdReadinessIssue } from '../src/lib/prod-readiness'

const DEFAULT_POOL_LIMIT = 250
const DEFAULT_FIELD_WINDOW_DAYS = 14

function loadLocalEnv() {
  for (const file of ['.env.local', '.env']) {
    const path = resolve(process.cwd(), file)
    if (!existsSync(path)) continue
    const text = readFileSync(path, 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
      if (!match) continue
      const [, key, rawValue] = match
      if (process.env[key]) continue
      let value = rawValue.trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      process.env[key] = value
    }
  }
}

function argValue(name: string, fallback: number) {
  const prefix = `${name}=`
  const found = process.argv.find(arg => arg.startsWith(prefix))
  return found ? Number(found.slice(prefix.length)) || fallback : fallback
}

function argString(name: string, fallback: string) {
  const prefix = `${name}=`
  const found = process.argv.find(arg => arg.startsWith(prefix))
  return found ? found.slice(prefix.length) || fallback : fallback
}

function hasFlag(name: string) {
  return process.argv.includes(name)
}

async function fetchText(url: string) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`)
  return response.text()
}

async function fetchLiveBrowserSupabaseContext(pageUrl: string): Promise<BrowserSupabaseContext> {
  const html = await fetchText(pageUrl)
  const inlineContext = extractBrowserSupabaseContext(html)
  if (inlineContext) return inlineContext

  const base = new URL(pageUrl)
  const scriptUrls = Array.from(html.matchAll(/<script[^>]+src=["']([^"']+\.js[^"']*)["']/g))
    .map(match => new URL(match[1], base).toString())

  for (const scriptUrl of scriptUrls) {
    const context = extractBrowserSupabaseContext(await fetchText(scriptUrl))
    if (context) return context
  }

  throw new Error(`Could not find browser Supabase context in ${pageUrl}`)
}

async function safeQuery(label: string, promise: PromiseLike<{ data: any[] | null; error: any }>, issues: ProdReadinessIssue[], options: { optional?: boolean } = {}) {
  const { data, error } = await promise
  if (error) {
    issues.push({
      severity: options.optional ? 'low' : 'critical',
      code: `${label.toUpperCase()}_QUERY_FAILED`,
      message: `${label} query failed`,
      details: { message: error.message, code: error.code },
    })
    return []
  }
  return data || []
}

async function main() {
  loadLocalEnv()

  const json = hasFlag('--json')
  const strict = hasFlag('--strict')
  const useLiveBrowserContext = hasFlag('--live-browser-context')
  const verifyLiveContext = useLiveBrowserContext || hasFlag('--verify-live-context')
  const liveAppUrl = argString('--live-app-url', 'https://www.golfpoolspro.com/login')
  const poolLimit = argValue('--pool-limit', DEFAULT_POOL_LIMIT)
  const fieldWindowDays = argValue('--field-window-days', DEFAULT_FIELD_WINDOW_DAYS)
  const includeTestPools = hasFlag('--include-test-pools')
  let supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  let usingServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)
  let liveBrowserContext: BrowserSupabaseContext | null = null

  if (verifyLiveContext) {
    liveBrowserContext = await fetchLiveBrowserSupabaseContext(liveAppUrl)
  }

  if (useLiveBrowserContext && liveBrowserContext) {
    supabaseUrl = liveBrowserContext.supabaseUrl
    supabaseKey = liveBrowserContext.anonKey
    usingServiceRole = false
  }

  if (!supabaseUrl || !supabaseKey) {
    const message = 'Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL plus SUPABASE_SERVICE_ROLE_KEY (preferred) or NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    if (json) console.log(JSON.stringify({ ok: false, issues: [{ severity: 'critical', code: 'MISSING_SUPABASE_CREDENTIALS', message }] }, null, 2))
    else console.error(`GPP production readiness audit\n\n${message}`)
    process.exit(2)
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const queryIssues: ProdReadinessIssue[] = []
  if (liveBrowserContext && !useLiveBrowserContext) {
    const mismatch = supabaseContextMismatchIssue(supabaseUrl, liveBrowserContext.supabaseUrl)
    if (mismatch) queryIssues.push(mismatch)
  }

  const pools = await safeQuery(
    'pools',
    supabase
      .from('gpp_pools')
      .select('*, gpp_tournaments(*)')
      .order('created_at', { ascending: false })
      .limit(poolLimit),
    queryIssues,
  )

  const poolIds = pools.map(pool => pool.id).filter(Boolean)
  const entries = poolIds.length > 0
    ? await safeQuery(
      'entries',
      supabase
        .from('gpp_entries')
        .select('*')
        .in('pool_id', poolIds),
      queryIssues,
    )
    : []

  const cronRuns = await safeQuery(
    'cron_runs',
    supabase
      .from('gpp_cron_runs')
      .select('*')
      .limit(100),
    queryIssues,
    { optional: true },
  )

  const promoRedemptions = poolIds.length > 0
    ? await safeQuery(
      'promo_redemptions',
      supabase
        .from('gpp_promo_redemptions')
        .select('pool_id, discount_cents, gpp_promo_codes(code, free_pool, discount_cents, target_amount_cents)')
        .in('pool_id', poolIds),
      queryIssues,
      { optional: !usingServiceRole },
    )
    : []

  const result = auditProdReadiness({
    pools,
    entries,
    promoRedemptions,
    cronRuns,
    usingServiceRole,
    poolLimit,
    fieldWindowDays,
    includeTestPools,
  })
  result.issues = sortProdReadinessIssues([...queryIssues, ...result.issues])
  result.counts = summarizeProdReadinessIssues(result.issues)
  result.ok = result.counts.critical === 0 && result.counts.high === 0

  if (json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log('GPP production readiness audit')
    console.log(`Checked at: ${result.checkedAt}`)
    console.log(`Supabase auth: ${usingServiceRole ? 'service role' : 'anon/RLS-limited'}${useLiveBrowserContext ? ' via live browser context' : ''}`)
    if (liveBrowserContext && !useLiveBrowserContext) console.log(`Live app context check: ${liveBrowserContext.supabaseUrl}`)
    console.log(`Pools checked: ${result.poolCount}; skipped test pools: ${result.skippedTestPools}; entries checked: ${result.entryCount}; cron rows checked: ${result.cronRunCount}`)
    console.log(`Issues: critical=${result.counts.critical} high=${result.counts.high} medium=${result.counts.medium} low=${result.counts.low} info=${result.counts.info}`)
    console.log('')
    if (result.issues.length === 0) {
      console.log('No issues found by the current audit rules.')
    } else {
      for (const item of result.issues) console.log(formatProdReadinessIssue(item))
    }
  }

  if (strict && !result.ok) process.exit(1)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
