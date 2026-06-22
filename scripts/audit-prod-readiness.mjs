#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
const DEFAULT_POOL_LIMIT = 250
const DEFAULT_FIELD_WINDOW_DAYS = 14
const LIVE_SCORE_STALE_MINUTES = 12
const FIELD_STALE_DAYS = 2

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

function argValue(name, fallback) {
  const prefix = `${name}=`
  const found = process.argv.find(arg => arg.startsWith(prefix))
  return found ? found.slice(prefix.length) : fallback
}

function hasFlag(name) {
  return process.argv.includes(name)
}

function daysFromToday(dateLike) {
  if (!dateLike) return null
  const date = new Date(`${String(dateLike).slice(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(date.getTime())) return null
  const today = new Date()
  const utcToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  return Math.round((date.getTime() - utcToday) / 86_400_000)
}

function minutesAgo(dateLike) {
  if (!dateLike) return null
  const time = new Date(dateLike).getTime()
  if (!Number.isFinite(time)) return null
  return Math.round((Date.now() - time) / 60_000)
}

function normalizeTournament(pool) {
  const value = pool?.gpp_tournaments
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function activeEntriesForPool(entriesByPool, poolId) {
  return (entriesByPool.get(poolId) || []).filter(entry => !entry.is_removed)
}

function expectedPoolFeeCents(entryCount) {
  const count = Number(entryCount || 0)
  if (count <= 5) return 0
  if (count <= 100) return Math.min(count - 5, 20) * 100
  return (20 + Math.ceil((count - 100) / 100) * 10) * 100
}

function isGroupedPool(pool) {
  return pool?.game_format === 'ranked_groups' || pool?.game_format === 'random_groups'
}

function isTournamentLive(tournament) {
  return tournament?.status === 'live'
}

function isTournamentCompleted(tournament) {
  return tournament?.status === 'completed'
}

function hasLeaderboardRows(tournament) {
  return Array.isArray(tournament?.leaderboard_json) && tournament.leaderboard_json.length > 0
}

function fieldRows(tournament) {
  return Array.isArray(tournament?.field_json) ? tournament.field_json : []
}

function finalPool(pool, tournament) {
  return Boolean(pool?.is_completed || pool?.results_finalized_at || isTournamentCompleted(tournament))
}

function issue(issues, severity, code, message, details = {}) {
  issues.push({ severity, code, message, details })
}

async function safeQuery(label, promise, issues, { optional = false } = {}) {
  const { data, error } = await promise
  if (error) {
    issue(issues, optional ? 'low' : 'critical', `${label.toUpperCase()}_QUERY_FAILED`, `${label} query failed`, {
      message: error.message,
      code: error.code,
    })
    return null
  }
  return data || []
}

function summarizeIssues(issues) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  for (const item of issues) counts[item.severity] = (counts[item.severity] || 0) + 1
  return counts
}

function formatIssue(item) {
  const details = Object.entries(item.details || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(' ')
  return `- [${item.severity.toUpperCase()}] ${item.code}: ${item.message}${details ? ` (${details})` : ''}`
}

loadLocalEnv()

const json = hasFlag('--json')
const strict = hasFlag('--strict')
const poolLimit = Number(argValue('--pool-limit', DEFAULT_POOL_LIMIT)) || DEFAULT_POOL_LIMIT
const fieldWindowDays = Number(argValue('--field-window-days', DEFAULT_FIELD_WINDOW_DAYS)) || DEFAULT_FIELD_WINDOW_DAYS
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const usingServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)

if (!supabaseUrl || !supabaseKey) {
  const message = 'Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL plus SUPABASE_SERVICE_ROLE_KEY (preferred) or NEXT_PUBLIC_SUPABASE_ANON_KEY.'
  if (json) console.log(JSON.stringify({ ok: false, issues: [{ severity: 'critical', code: 'MISSING_SUPABASE_CREDENTIALS', message }] }, null, 2))
  else console.error(`GPP production readiness audit\n\n${message}`)
  process.exit(2)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const issues = []
if (!usingServiceRole) {
  issue(issues, 'medium', 'AUDIT_USING_ANON_KEY', 'Audit is using anon key; RLS may hide production rows. Prefer SUPABASE_SERVICE_ROLE_KEY for read-only ops audit.')
}

const pools = await safeQuery(
  'pools',
  supabase
    .from('gpp_pools')
    .select('*, gpp_tournaments(*)')
    .order('created_at', { ascending: false })
    .limit(poolLimit),
  issues,
)

const poolIds = (pools || []).map(pool => pool.id).filter(Boolean)
let entries = []
if (poolIds.length > 0) {
  entries = await safeQuery(
    'entries',
    supabase
      .from('gpp_entries')
      .select('*')
      .in('pool_id', poolIds),
    issues,
  ) || []
}

const cronRuns = await safeQuery(
  'cron_runs',
  supabase
    .from('gpp_cron_runs')
    .select('*')
    .limit(100),
  issues,
  { optional: true },
)

const entriesByPool = new Map()
for (const entry of entries) {
  const list = entriesByPool.get(entry.pool_id) || []
  list.push(entry)
  entriesByPool.set(entry.pool_id, list)
}

for (const pool of pools || []) {
  const tournament = normalizeTournament(pool)
  const activeEntries = activeEntriesForPool(entriesByPool, pool.id)
  const entryCount = activeEntries.length
  const expectedFee = expectedPoolFeeCents(entryCount)
  const amountPaid = Number(pool.amount_paid_cents || 0)
  const dueCents = Math.max(0, expectedFee - amountPaid)
  const lockedOrLive = Boolean(pool.is_locked || isTournamentLive(tournament) || isTournamentCompleted(tournament) || hasLeaderboardRows(tournament))
  const isFinal = finalPool(pool, tournament)
  const poolLabel = `${pool.name || 'Unnamed pool'} (${pool.id})`
  const startDays = daysFromToday(tournament?.start_date)
  const endDays = daysFromToday(tournament?.end_date)

  if (isFinal && pool.payment_status === 'archived_unpaid') {
    issue(issues, 'critical', 'FINAL_POOL_ARCHIVED_UNPAID', 'Final/completed pool has archived_unpaid payment status; final boards should not be billing-blocked.', {
      pool: poolLabel,
      tournament: tournament?.name,
    })
  }

  if (lockedOrLive && dueCents > 0 && pool.payment_status === 'active') {
    issue(issues, 'high', 'ACTIVE_STATUS_WITH_BALANCE_DUE', 'Pool is stored active even though active entry count implies a balance due.', {
      pool: poolLabel,
      entryCount,
      amountPaidCents: amountPaid,
      expectedFeeCents: expectedFee,
      dueCents,
    })
  }

  if (isFinal) {
    const missingFrozen = activeEntries.filter(entry => !Array.isArray(entry.counting_scores) || entry.rank == null || entry.total_score == null)
    if (activeEntries.length > 0 && missingFrozen.length > 0) {
      issue(issues, 'critical', 'FINAL_POOL_MISSING_FROZEN_RESULTS', 'Final/completed pool has entries without frozen final rank/score/counting_scores.', {
        pool: poolLabel,
        missingEntries: missingFrozen.length,
        activeEntries: activeEntries.length,
      })
    }
  }

  if (isTournamentLive(tournament)) {
    const rows = Array.isArray(tournament?.leaderboard_json) ? tournament.leaderboard_json.length : 0
    const staleMinutes = minutesAgo(tournament?.last_scores_fetch)
    if (rows === 0) {
      issue(issues, 'critical', 'LIVE_TOURNAMENT_EMPTY_LEADERBOARD', 'Live tournament has no stored leaderboard rows.', {
        pool: poolLabel,
        tournament: tournament?.name,
      })
    }
    if (staleMinutes == null || staleMinutes > LIVE_SCORE_STALE_MINUTES) {
      issue(issues, 'high', 'LIVE_SCORE_STALE', 'Live tournament scores are stale or missing last_scores_fetch.', {
        pool: poolLabel,
        tournament: tournament?.name,
        lastScoresFetch: tournament?.last_scores_fetch,
        staleMinutes,
      })
    }
  }

  if (!isFinal && startDays != null && startDays >= 0 && startDays <= fieldWindowDays) {
    const rows = fieldRows(tournament)
    const staleFieldDays = tournament?.last_field_fetch ? Math.round((Date.now() - new Date(tournament.last_field_fetch).getTime()) / 86_400_000) : null
    if (rows.length < 40) {
      issue(issues, 'high', 'UPCOMING_POOL_FIELD_NOT_READY', 'Upcoming pool is inside field-readiness window but stored field has fewer than 40 golfers.', {
        pool: poolLabel,
        tournament: tournament?.name,
        startDate: tournament?.start_date,
        startDays,
        fieldCount: rows.length,
        fieldSource: tournament?.field_source,
      })
    }
    if (staleFieldDays == null || staleFieldDays > FIELD_STALE_DAYS) {
      issue(issues, 'medium', 'UPCOMING_POOL_FIELD_STALE', 'Upcoming pool field is missing or stale inside readiness window.', {
        pool: poolLabel,
        tournament: tournament?.name,
        startDate: tournament?.start_date,
        lastFieldFetch: tournament?.last_field_fetch,
        staleFieldDays,
      })
    }
    if (isGroupedPool(pool) && startDays <= 2 && !pool.groups_finalized_at) {
      issue(issues, 'high', 'GROUPED_POOL_DUE_WITHOUT_GROUPS', 'Grouped pool is near start date but groups are not finalized.', {
        pool: poolLabel,
        tournament: tournament?.name,
        startDate: tournament?.start_date,
        startDays,
      })
    }
  }

  if (!isFinal && endDays != null && endDays < 0 && !pool.results_finalized_at) {
    issue(issues, 'high', 'PAST_POOL_NOT_FINALIZED', 'Tournament end date is past but pool has no results_finalized_at.', {
      pool: poolLabel,
      tournament: tournament?.name,
      endDate: tournament?.end_date,
    })
  }
}

if (cronRuns && cronRuns.length === 0) {
  issue(issues, 'medium', 'NO_CRON_RUN_HISTORY', 'gpp_cron_runs returned no rows; cron health cannot be verified from DB history.')
}

const sortedIssues = issues.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.code.localeCompare(b.code))
const counts = summarizeIssues(sortedIssues)
const ok = counts.critical === 0 && counts.high === 0
const result = {
  ok,
  checkedAt: new Date().toISOString(),
  usingServiceRole,
  poolLimit,
  poolCount: pools?.length || 0,
  entryCount: entries.length,
  cronRunCount: cronRuns?.length || 0,
  counts,
  issues: sortedIssues,
}

if (json) {
  console.log(JSON.stringify(result, null, 2))
} else {
  console.log('GPP production readiness audit')
  console.log(`Checked at: ${result.checkedAt}`)
  console.log(`Supabase auth: ${usingServiceRole ? 'service role' : 'anon/RLS-limited'}`)
  console.log(`Pools checked: ${result.poolCount}; entries checked: ${result.entryCount}; cron rows checked: ${result.cronRunCount}`)
  console.log(`Issues: critical=${counts.critical} high=${counts.high} medium=${counts.medium} low=${counts.low} info=${counts.info}`)
  console.log('')
  if (sortedIssues.length === 0) {
    console.log('No issues found by the current audit rules.')
  } else {
    for (const item of sortedIssues) console.log(formatIssue(item))
  }
}

if (strict && !ok) process.exit(1)
