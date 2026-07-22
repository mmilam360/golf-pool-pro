import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/cron-auth'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

type HealthKind = 'live-scoring' | 'fields' | 'locks'

type Context = {
  params: Promise<{ kind: string }>
}

const rpcByKind: Record<HealthKind, string> = {
  'live-scoring': 'gpp_live_scoring_health',
  fields: 'gpp_field_health',
  locks: 'gpp_lock_health',
}

function isHealthKind(value: string): value is HealthKind {
  return value === 'live-scoring' || value === 'fields' || value === 'locks'
}

function jsonArrayLength(value: unknown) {
  return Array.isArray(value) ? value.length : 0
}

function isStale(value: string | null | undefined, staleAfterMinutes: number) {
  if (!value) return true
  const time = new Date(value).getTime()
  return !Number.isFinite(time) || Date.now() - time > staleAfterMinutes * 60_000
}

async function latestCronRun(supabase: any, route: string, status: 'success' | 'failure') {
  const { data, error } = await supabase
    .from('gpp_cron_runs')
    .select('route, started_at, finished_at, duration_ms, status, error')
    .eq('route', route)
    .eq('status', status)
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return null
  return data || null
}

async function liveScoringFallback(supabase: any, staleAfterMinutes: number) {
  const { data: tournaments, error } = await supabase
    .from('gpp_tournaments')
    .select('id, name, external_id, status, last_scores_fetch, leaderboard_json')
    .eq('status', 'live')
    .order('start_date', { ascending: true })
  if (error) throw error

  const activeTournaments = (tournaments || []).map((tournament: any) => ({
    id: tournament.id,
    name: tournament.name,
    external_id: tournament.external_id,
    status: tournament.status,
    last_scores_fetch: tournament.last_scores_fetch,
    leaderboard_player_count: jsonArrayLength(tournament.leaderboard_json),
  }))
  const lastScoreSync = activeTournaments
    .map((tournament: any) => tournament.last_scores_fetch)
    .filter(Boolean)
    .sort()
    .at(-1) || null

  const { count: livePoolsCount } = await supabase
    .from('gpp_pools')
    .select('id, gpp_tournaments!inner(status)', { count: 'exact', head: true })
    .eq('is_completed', false)
    .eq('gpp_tournaments.status', 'live')

  return {
    active_tournaments: activeTournaments,
    last_score_sync: lastScoreSync,
    last_successful_run: await latestCronRun(supabase, '/api/cron/sync-tournaments?live=1', 'success'),
    last_failed_run: await latestCronRun(supabase, '/api/cron/sync-tournaments?live=1', 'failure'),
    leaderboard_player_count: activeTournaments.reduce((sum: number, tournament: any) => sum + tournament.leaderboard_player_count, 0),
    live_pools_count: livePoolsCount || 0,
    stale_after_minutes: staleAfterMinutes,
    stale: isStale(lastScoreSync, staleAfterMinutes),
  }
}

function suspiciousFieldReason(tournament: any, duplicateFingerprints: Set<string>, staleAfterMinutes: number) {
  const fieldCount = jsonArrayLength(tournament.field_json)
  if (fieldCount === 0) return 'empty'
  if (fieldCount < 40) return 'too_small'
  if (tournament.field_fingerprint && duplicateFingerprints.has(tournament.field_fingerprint)) return 'duplicate_fingerprint'
  const topNames = Array.isArray(tournament.field_json)
    ? tournament.field_json.slice(0, 8).map((player: any) => player?.name)
    : []
  const staleSignature = ['Kevin Kisner', 'Zac Blair', 'Christiaan Bezuidenhout', 'Nick Hardy']
  if (staleSignature.filter(name => topNames.includes(name)).length >= 3) return 'known_stale_signature'
  if (!tournament.last_field_fetch) return 'never_fetched'
  if (isStale(tournament.last_field_fetch, staleAfterMinutes)) return 'stale_field_fetch'
  return null
}

async function fieldFallback(supabase: any, staleAfterMinutes: number) {
  const { data: rows, error } = await supabase
    .from('gpp_tournaments')
    .select('id, name, external_id, start_date, field_source, last_field_fetch, field_fingerprint, field_json')
    .eq('status', 'upcoming')
    .order('start_date', { ascending: true })
    .limit(20)
  if (error) throw error

  const counts = new Map<string, number>()
  for (const row of rows || []) {
    if (row.field_fingerprint) counts.set(row.field_fingerprint, (counts.get(row.field_fingerprint) || 0) + 1)
  }
  const duplicates = new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([fingerprint]) => fingerprint))
  const upcoming = (rows || []).map((row: any) => {
    const suspiciousReason = suspiciousFieldReason(row, duplicates, staleAfterMinutes)
    return {
      id: row.id,
      name: row.name,
      external_id: row.external_id,
      start_date: row.start_date,
      field_source: row.field_source,
      last_field_fetch: row.last_field_fetch,
      field_fingerprint: row.field_fingerprint,
      field_count: jsonArrayLength(row.field_json),
      suspicious_reason: suspiciousReason,
    }
  })

  return {
    upcoming_tournaments: upcoming,
    suspicious_placeholder_fingerprints: upcoming
      .filter((row: any) => row.suspicious_reason)
      .map((row: any) => ({
        tournament_id: row.id,
        name: row.name,
        field_fingerprint: row.field_fingerprint,
        reason: row.suspicious_reason,
        field_count: row.field_count,
        last_field_fetch: row.last_field_fetch,
      })),
    last_successful_run: await latestCronRun(supabase, '/api/cron/refresh-fields', 'success'),
    last_failed_run: await latestCronRun(supabase, '/api/cron/refresh-fields', 'failure'),
  }
}

function groupLockDueAt(startDate: string) {
  const date = new Date(`${startDate}T12:00:00Z`)
  if (!Number.isFinite(date.getTime())) return null
  const day = date.getUTCDay()
  const daysSinceTuesday = (day - 2 + 7) % 7
  date.setUTCDate(date.getUTCDate() - daysSinceTuesday)
  date.setUTCHours(12, 0, 0, 0)
  const easternFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = Object.fromEntries(easternFormatter.formatToParts(date).map(part => [part.type, part.value]))
  const easternLocalAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute))
  return new Date(easternLocalAsUtc + 4 * 60 * 60_000).toISOString()
}

async function lockFallback(supabase: any) {
  const { data: duePools, error: dueError } = await supabase
    .from('gpp_pools')
    .select('id, name, game_format, lock_at, gpp_tournaments(id, name, status, start_date)')
    .eq('is_completed', false)
    .eq('is_locked', false)
    .not('lock_at', 'is', null)
    .lte('lock_at', new Date().toISOString())
    .order('lock_at', { ascending: true })
    .limit(50)
  if (dueError) throw dueError

  const { data: groupedRows, error: groupedError } = await supabase
    .from('gpp_pools')
    .select('id, name, game_format, groups_finalized_at, gpp_tournaments(id, name, start_date)')
    .eq('is_completed', false)
    .in('game_format', ['ranked_groups', 'random_groups'])
    .is('groups_finalized_at', null)
    .limit(200)
  if (groupedError) throw groupedError

  const now = Date.now()
  const unfinalized = (groupedRows || []).map((pool: any) => {
    const tournament = Array.isArray(pool.gpp_tournaments) ? pool.gpp_tournaments[0] : pool.gpp_tournaments
    const dueAt = tournament?.start_date ? groupLockDueAt(tournament.start_date) : null
    return { pool, tournament, dueAt }
  }).filter((row: any) => row.dueAt && new Date(row.dueAt).getTime() <= now).slice(0, 50)

  const { data: unlockedLive, error: unlockedError } = await supabase
    .from('gpp_pools')
    .select('id, name, game_format, gpp_tournaments!inner(id, name, status, last_scores_fetch)')
    .eq('is_completed', false)
    .eq('is_locked', false)
    .eq('gpp_tournaments.status', 'live')
    .limit(50)
  if (unlockedError) throw unlockedError

  return {
    pools_due_to_lock: (duePools || []).map((pool: any) => ({
      id: pool.id,
      name: pool.name,
      game_format: pool.game_format,
      lock_at: pool.lock_at,
      tournament: Array.isArray(pool.gpp_tournaments) ? pool.gpp_tournaments[0] : pool.gpp_tournaments,
    })),
    unfinalized_grouped_pools_past_tuesday_lock: unfinalized.map((row: any) => ({
      id: row.pool.id,
      name: row.pool.name,
      game_format: row.pool.game_format,
      tournament: row.tournament,
      group_lock_due_at: row.dueAt,
    })),
    unlocked_pools_after_first_tee: (unlockedLive || []).map((pool: any) => ({
      id: pool.id,
      name: pool.name,
      game_format: pool.game_format,
      tournament: Array.isArray(pool.gpp_tournaments) ? pool.gpp_tournaments[0] : pool.gpp_tournaments,
    })),
    last_successful_run: await latestCronRun(supabase, '/api/cron/sync-tournaments?live=1', 'success'),
    last_failed_run: await latestCronRun(supabase, '/api/cron/sync-tournaments?live=1', 'failure'),
  }
}

async function fallbackHealth(kind: HealthKind, supabase: any, staleAfterMinutes: number) {
  if (kind === 'live-scoring') return liveScoringFallback(supabase, staleAfterMinutes)
  if (kind === 'fields') return fieldFallback(supabase, staleAfterMinutes || 1440)
  return lockFallback(supabase)
}

export async function GET(request: Request, context: Context) {
  const authError = requireCronAuth(request)
  if (authError) return authError

  const { kind } = await context.params
  if (!isHealthKind(kind)) {
    return NextResponse.json({ ok: false, error: 'Unknown health check' }, { status: 404 })
  }

  const staleAfterMinutes = Number(new URL(request.url).searchParams.get('stale_after_minutes')) || (kind === 'fields' ? 1440 : 10)
  const supabase = createServiceClient() as any
  const { data, error } = await supabase.rpc(rpcByKind[kind], { stale_after_minutes: staleAfterMinutes })

  if (!error) {
    return NextResponse.json({ ok: true, check: kind, ...data })
  }

  const missingRpc = error.code === '42883' || String(error.message || '').includes('Could not find the function')
  if (!missingRpc) {
    return NextResponse.json({ ok: false, check: kind, error: error.message }, { status: 500 })
  }

  try {
    const fallback = await fallbackHealth(kind, supabase, staleAfterMinutes)
    return NextResponse.json({ ok: true, check: kind, mode: 'fallback', ...fallback })
  } catch (fallbackError: any) {
    return NextResponse.json({ ok: false, check: kind, error: fallbackError.message }, { status: 500 })
  }
}
