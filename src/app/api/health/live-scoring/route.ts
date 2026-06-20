import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/cron-auth'
import { createServiceClient } from '@/lib/supabase/service'
import { APP_DATE_TIME_ZONE, todayDateOnly } from '@/lib/date-utils'
import { summarizeLiveScoringHealth } from '@/lib/live-scoring-health'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function staleAfterMinutes(request: Request) {
  const value = Number(new URL(request.url).searchParams.get('stale_after_minutes'))
  return Number.isFinite(value) && value > 0 ? value : 15
}

export async function GET(request: Request) {
  const authError = requireCronAuth(request)
  if (authError) return authError

  try {
    const now = new Date()
    const today = todayDateOnly(APP_DATE_TIME_ZONE, now)
    const supabase = createServiceClient() as any

    const { data: tournaments, error: tournamentError } = await supabase
      .from('gpp_tournaments')
      .select('id, external_id, name, status, start_date, end_date, last_scores_fetch, leaderboard_json')
      .lte('start_date', today)
      .gte('end_date', today)
      .order('start_date', { ascending: false })
      .limit(20)

    if (tournamentError) throw tournamentError

    const tournamentIds = (tournaments || []).map((tournament: any) => tournament.id)
    let pools: any[] = []
    if (tournamentIds.length > 0) {
      const { data, error } = await supabase
        .from('gpp_pools')
        .select('id, tournament_id, is_locked, is_completed')
        .in('tournament_id', tournamentIds)
        .eq('is_completed', false)
        .limit(1000)
      if (error) throw error
      pools = data || []
    }

    const { data: cronRuns, error: cronError } = await supabase
      .from('gpp_cron_runs')
      .select('route, status, started_at, finished_at, duration_ms, error')
      .ilike('route', '%/api/cron/sync-tournaments%')
      .order('started_at', { ascending: false })
      .limit(20)

    if (cronError) throw cronError

    const summary = summarizeLiveScoringHealth({
      tournaments: tournaments || [],
      pools,
      cronRuns: cronRuns || [],
      staleAfterMinutes: staleAfterMinutes(request),
      now,
    })

    return NextResponse.json(summary, { status: summary.ok ? 200 : 503 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
