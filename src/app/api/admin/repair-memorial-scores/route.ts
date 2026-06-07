import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getLeaderboard } from '@/lib/golf-api'
import { finalRoundLooksComplete } from '@/lib/tournament-sync'
import { recordNotificationEvent, sendPushToUser } from '@/lib/notifications/push'

export const runtime = 'nodejs'

const REPAIR_TOKEN = 'memorial-score-repair-2026-06-07-7f29e32b6c1a4d0ea9d8'
const MEMORIAL_EXTERNAL_ID = '401811950'

export async function POST(request: Request) {
  const token = request.headers.get('x-repair-token') || new URL(request.url).searchParams.get('token')
  const cronSecret = process.env.CRON_SECRET
  if (token !== REPAIR_TOKEN && (!cronSecret || token !== cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient() as any
  const { data: existingTournament, error: existingTournamentError } = await supabase
    .from('gpp_tournaments')
    .select('id, leaderboard_json')
    .eq('external_id', MEMORIAL_EXTERNAL_ID)
    .single()
  if (existingTournamentError) throw existingTournamentError

  const leaderboard = await getLeaderboard(MEMORIAL_EXTERNAL_ID)
  if (!leaderboard?.leaderboard?.length) {
    return NextResponse.json({ ok: false, error: 'Could not fetch Memorial leaderboard' }, { status: 502 })
  }

  const storedByName = new Map(
    (Array.isArray(existingTournament?.leaderboard_json) ? existingTournament.leaderboard_json : [])
      .map((player: any) => [String(player?.name || '').toLowerCase(), player])
      .filter(([name]: [string, any]) => Boolean(name))
  )

  let repairedStatuses = 0
  const repairedLeaderboard = leaderboard.leaderboard.map(player => {
    const storedPlayer = storedByName.get(String(player.name || '').toLowerCase()) as any
    const roundScores = (player.roundScores && player.roundScores.length > 0) ? player.roundScores : storedPlayer?.roundScores
    const hasWeekendScores = (roundScores || []).some((round: any) => Number(round.round) >= 3 && (round.complete || (round.holes || []).length > 0))
    const mergedPlayer = { ...storedPlayer, ...player, roundScores }
    if ((player.status === 'cut' || storedPlayer?.status === 'cut') && hasWeekendScores) {
      repairedStatuses += 1
      return { ...mergedPlayer, status: 'active' as const, position: player.position === 'CUT' || storedPlayer?.position === 'CUT' ? '' : player.position }
    }
    return mergedPlayer
  })

  const weekendCutErrors = repairedLeaderboard.filter(player =>
    player.status === 'cut'
    && (player.roundScores || []).some(round => Number(round.round) >= 3 && (round.complete || (round.holes || []).length > 0))
  )

  if (weekendCutErrors.length > 0) {
    return NextResponse.json({
      ok: false,
      error: 'Refusing to store leaderboard with made-cut players marked cut',
      weekendCutErrors: weekendCutErrors.map(player => player.name),
    }, { status: 409 })
  }

  const completed = finalRoundLooksComplete(repairedLeaderboard, leaderboard.round)
  const status = completed ? 'completed' : leaderboard.status

  const { data: tournament, error: tournamentError } = await supabase
    .from('gpp_tournaments')
    .update({
      status,
      leaderboard_json: repairedLeaderboard,
      field_json: repairedLeaderboard,
      last_scores_fetch: new Date().toISOString(),
    })
    .eq('external_id', MEMORIAL_EXTERNAL_ID)
    .select('id, name, status')
    .single()

  if (tournamentError) throw tournamentError

  const { data: pools, error: poolsError } = await supabase
    .from('gpp_pools')
    .select('id, name, owner_id')
    .eq('tournament_id', tournament.id)

  if (poolsError) throw poolsError

  let notificationCandidates = 0
  let notificationEvents = 0
  let pushSent = 0

  for (const pool of pools || []) {
    const { data: entries, error: entriesError } = await supabase
      .from('gpp_entries')
      .select('user_id')
      .eq('pool_id', pool.id)
      .eq('is_removed', false)

    if (entriesError) throw entriesError

    const userIds = Array.from(new Set([pool.owner_id, ...((entries || []).map((entry: any) => entry.user_id))].filter(Boolean))) as string[]
    for (const userId of userIds) {
      notificationCandidates += 1
      const title = 'Scores corrected'
      const body = `${pool.name}: final standings have been recalculated.`
      const dedupeKey = `corrected_scores:${pool.id}:${MEMORIAL_EXTERNAL_ID}:${userId}:v2`
      const inserted = await recordNotificationEvent({
        userId,
        poolId: pool.id,
        type: 'leaderboard_live',
        dedupeKey,
        payload: { title, body, corrected: true },
      })
      if (!inserted) continue
      notificationEvents += 1
      const push = await sendPushToUser(userId, {
        title,
        body,
        url: `/pool/${pool.id}`,
        tag: dedupeKey,
      })
      pushSent += push.sent || 0
    }
  }

  return NextResponse.json({
    ok: true,
    tournament: { id: tournament.id, name: tournament.name, status },
    leaderboard: {
      players: repairedLeaderboard.length,
      active: repairedLeaderboard.filter(player => player.status === 'active').length,
      cut: repairedLeaderboard.filter(player => player.status === 'cut').length,
      round: leaderboard.round,
      completed,
      repairedStatuses,
    },
    pools: (pools || []).map((pool: any) => ({ id: pool.id, name: pool.name })),
    notifications: { candidates: notificationCandidates, events: notificationEvents, pushSent },
  })
}
