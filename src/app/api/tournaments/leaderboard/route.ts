export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getEspnLeaderboardCutLine } from '@/lib/golf-api'
import { createServiceClient } from '@/lib/supabase/service'

function validEventId(eventId: string | null) {
  return Boolean(eventId && /^\d{3,20}$/.test(eventId))
}

function hasUsableLeaderboard(leaderboard: unknown) {
  if (!Array.isArray(leaderboard) || leaderboard.length === 0) return false
  const namedRows = leaderboard.filter(player => {
    const name = String((player as any)?.name || '').trim().toLowerCase()
    return name && name !== 'unknown'
  }).length
  return namedRows >= Math.max(1, Math.ceil(leaderboard.length * 0.5))
}

function currentRound(leaderboard: any[]) {
  const rounds = leaderboard.flatMap(player => Array.isArray(player?.roundScores) ? player.roundScores : [])
    .map(round => Number(round?.round))
    .filter(Number.isFinite)
  return rounds.length ? Math.max(...rounds) : 0
}

function formatScoreToPar(scoreToPar: number) {
  if (scoreToPar === 0) return 'E'
  return scoreToPar > 0 ? `+${scoreToPar}` : String(scoreToPar)
}

function cutLineFromStoredLeaderboard(leaderboard: any[]) {
  const cutScores = leaderboard
    .filter(player => String(player?.status || '').toLowerCase() === 'cut')
    .map(player => Number(player?.scoreToPar))
    .filter(Number.isFinite)
  if (cutScores.length === 0) return null

  const firstCutScore = Math.min(...cutScores)
  const madeCutScores = leaderboard
    .filter(player => String(player?.status || '').toLowerCase() === 'active')
    .map(player => Number(player?.scoreToPar))
    .filter(score => Number.isFinite(score) && score < firstCutScore)
  if (madeCutScores.length === 0) return null

  const scoreToPar = Math.max(...madeCutScores)
  return {
    score: formatScoreToPar(scoreToPar),
    scoreToPar,
    count: madeCutScores.filter(score => score <= scoreToPar).length,
    projected: false,
  }
}

function cachedJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      'Cache-Control': 'public, s-maxage=45, stale-while-revalidate=90',
      ...init?.headers,
    },
  })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get('id')
  if (!eventId) return NextResponse.json({ error: 'Missing event id' }, { status: 400 })
  if (!validEventId(eventId)) return NextResponse.json({ error: 'Invalid event id' }, { status: 400 })

  try {
    const supabase = createServiceClient() as any
    const { data: tournament, error } = await supabase
      .from('gpp_tournaments')
      .select('id, external_id, name, course, location, start_date, end_date, status, leaderboard_json, last_scores_fetch')
      .eq('external_id', eventId)
      .maybeSingle()

    if (error) throw error
    if (!tournament) return cachedJson({ error: 'Not found' }, { status: 404 })

    const leaderboard = Array.isArray(tournament.leaderboard_json) ? tournament.leaderboard_json : []
    if (!hasUsableLeaderboard(leaderboard)) {
      return cachedJson({ error: 'Leaderboard unavailable' }, { status: 502 })
    }

    const cutLine = await getEspnLeaderboardCutLine(eventId).catch(() => null)
      || cutLineFromStoredLeaderboard(leaderboard)

    return cachedJson({
      id: tournament.external_id || tournament.id,
      name: tournament.name,
      startDate: tournament.start_date,
      endDate: tournament.end_date,
      course: tournament.course || '',
      location: tournament.location || '',
      status: tournament.status || 'upcoming',
      round: currentRound(leaderboard),
      leaderboard,
      cutLine,
      lastScoresFetch: tournament.last_scores_fetch || null,
    })
  } catch {
    return cachedJson({ error: 'Leaderboard unavailable' }, { status: 502 })
  }
}
