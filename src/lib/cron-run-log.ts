import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/cron-auth'
import { createServiceClient } from '@/lib/supabase/service'

type CronBody = Record<string, unknown>

function routeFromRequest(request: Request) {
  const url = new URL(request.url)
  return `${url.pathname}${url.search}`
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function compactValue(value: unknown, depth = 0): unknown {
  if (value == null) return value
  if (typeof value === 'string') return value.length > 500 ? `${value.slice(0, 500)}…` : value
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (depth >= 4) return '[truncated]'

  if (Array.isArray(value)) {
    const items = value.slice(0, 25).map(item => compactValue(item, depth + 1))
    if (value.length > items.length) items.push(`[${value.length - items.length} more]`)
    return items
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 50)
    return Object.fromEntries(entries.map(([key, item]) => [key, compactValue(item, depth + 1)]))
  }

  return String(value)
}

function canonicalDedupeRoute(route: string) {
  try {
    const url = new URL(route, 'https://cron.local')
    if (url.pathname === '/api/cron/sync-tournaments') {
      const live = url.searchParams.get('live')
      if (live === '1' || live === 'true') return '/api/cron/sync-tournaments?live=1'
    }
  } catch {
    // Fall back to the raw route below.
  }
  return route
}

function dedupeWindowMinutes(route: string) {
  return canonicalDedupeRoute(route) === '/api/cron/sync-tournaments?live=1' ? 1 : 60
}

function dedupeKey(route: string, startedAt: Date) {
  const canonicalRoute = canonicalDedupeRoute(route)
  const windowMinutes = dedupeWindowMinutes(canonicalRoute)
  const bucket = new Date(startedAt)
  bucket.setUTCSeconds(0, 0)
  bucket.setUTCMinutes(Math.floor(bucket.getUTCMinutes() / windowMinutes) * windowMinutes)
  return `${canonicalRoute}:${bucket.toISOString().slice(0, 16)}`
}

async function startCronRun(route: string, startedAt: Date): Promise<{ id?: string; duplicate: boolean }> {
  try {
    const supabase = createServiceClient() as any
    const { data, error } = await supabase
      .from('gpp_cron_runs')
      .insert({
        route,
        started_at: startedAt.toISOString(),
        finished_at: startedAt.toISOString(),
        duration_ms: 0,
        status: 'running',
        response: { ok: true, status: 'running' },
        dedupe_key: dedupeKey(route, startedAt),
      })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') return { duplicate: true }
      console.warn('[cron] failed to start cron run', error.message)
      return { duplicate: false }
    }

    return { id: data?.id, duplicate: false }
  } catch (error) {
    console.warn('[cron] failed to start cron run', errorMessage(error))
    return { duplicate: false }
  }
}

async function finishCronRun(params: {
  id?: string
  route: string
  startedAt: Date
  finishedAt: Date
  status: 'success' | 'failure'
  response: CronBody
  error?: string | null
}) {
  try {
    const supabase = createServiceClient() as any
    const row = {
      route: params.route,
      started_at: params.startedAt.toISOString(),
      finished_at: params.finishedAt.toISOString(),
      duration_ms: params.finishedAt.getTime() - params.startedAt.getTime(),
      status: params.status,
      response: compactValue(params.response),
      error: params.error || null,
    }

    const { error } = params.id
      ? await supabase.from('gpp_cron_runs').update(row).eq('id', params.id)
      : await supabase.from('gpp_cron_runs').insert(row)

    if (error) console.warn('[cron] failed to finish cron run', error.message)
  } catch (error) {
    console.warn('[cron] failed to finish cron run', errorMessage(error))
  }
}

export async function runCronRoute(request: Request, handler: () => Promise<CronBody> | CronBody) {
  const authError = requireCronAuth(request)
  if (authError) return authError

  const route = routeFromRequest(request)
  const startedAt = new Date()
  const run = await startCronRun(route, startedAt)
  if (run.duplicate) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'duplicate cron run' })
  }

  try {
    const result = await handler()
    const body = { ok: true, ...result }
    await finishCronRun({
      id: run.id,
      route,
      startedAt,
      finishedAt: new Date(),
      status: 'success',
      response: body,
    })
    return NextResponse.json(body)
  } catch (error) {
    const message = errorMessage(error)
    const body = { ok: false, error: message }
    await finishCronRun({
      id: run.id,
      route,
      startedAt,
      finishedAt: new Date(),
      status: 'failure',
      response: body,
      error: message,
    })
    return NextResponse.json(body, { status: 500 })
  }
}
