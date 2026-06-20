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

async function recordCronRun(params: {
  route: string
  startedAt: Date
  finishedAt: Date
  status: 'success' | 'failure'
  response: CronBody
  error?: string | null
}) {
  try {
    const supabase = createServiceClient() as any
    const { error } = await supabase.from('gpp_cron_runs').insert({
      route: params.route,
      started_at: params.startedAt.toISOString(),
      finished_at: params.finishedAt.toISOString(),
      duration_ms: params.finishedAt.getTime() - params.startedAt.getTime(),
      status: params.status,
      response: compactValue(params.response),
      error: params.error || null,
    })
    if (error) console.warn('[cron] failed to record cron run', error.message)
  } catch (error) {
    console.warn('[cron] failed to record cron run', errorMessage(error))
  }
}

export async function runCronRoute(request: Request, handler: () => Promise<CronBody> | CronBody) {
  const authError = requireCronAuth(request)
  if (authError) return authError

  const route = routeFromRequest(request)
  const startedAt = new Date()

  try {
    const result = await handler()
    const body = { ok: true, ...result }
    await recordCronRun({
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
    await recordCronRun({
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
