import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { rankEntries, scoreEntry } from '@/lib/scoring'
import { notificationPrefsAllow, recordNotificationEvent, sendPushToUser } from '@/lib/notifications/push'
import type { GolfPlayer } from '@/lib/golf-api'

export const runtime = 'nodejs'

type Prefs = { user_id: string; pick_deadline?: boolean; leaderboard_live?: boolean; took_lead?: boolean }

function isAuthorized(request: Request) {
  const expectedSecret = process.env.CRON_SECRET
  if (!expectedSecret) return true
  const { searchParams } = new URL(request.url)
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || searchParams.get('token')
  return token === expectedSecret
}

function dateKey(value?: string | null) {
  return value ? value.split('T')[0] : new Date().toISOString().slice(0, 10)
}

function hoursUntil(value?: string | null) {
  if (!value) return null
  const ms = new Date(value).getTime() - Date.now()
  if (!Number.isFinite(ms)) return null
  return ms / (60 * 60 * 1000)
}

function hasRecentScores(tournament: any) {
  if (tournament?.status !== 'live' || !tournament.last_scores_fetch) return false
  const lastFetchMs = new Date(tournament.last_scores_fetch).getTime()
  return Number.isFinite(lastFetchMs) && Date.now() - lastFetchMs <= 10 * 60 * 1000
}

async function loadPrefs(supabase: any) {
  const { data } = await supabase.from('gpp_notification_preferences').select('*')
  return new Map<string, Prefs>((data || []).map((pref: Prefs) => [pref.user_id, pref]))
}

async function sendOnce(params: {
  userId: string
  poolId: string
  type: 'pick_deadline' | 'leaderboard_live' | 'took_lead'
  dedupeKey: string
  title: string
  body: string
}) {
  const inserted = await recordNotificationEvent({
    userId: params.userId,
    poolId: params.poolId,
    type: params.type,
    dedupeKey: params.dedupeKey,
    payload: { title: params.title, body: params.body },
  })
  if (!inserted) return { sent: 0, duplicate: true }
  const result = await sendPushToUser(params.userId, {
    title: params.title,
    body: params.body,
    url: `/pool/${params.poolId}`,
    tag: params.dedupeKey,
  })
  return { sent: result.sent, duplicate: false }
}

async function sendPickDeadlineReminders(supabase: any, prefsByUser: Map<string, Prefs>) {
  const { data: pools, error } = await supabase
    .from('gpp_pools')
    .select('id, name, is_locked, owner_id, gpp_tournaments(name, start_date, status)')
    .eq('is_completed', false)
  if (error) throw error

  let sent = 0
  let candidates = 0
  for (const pool of pools || []) {
    const tournament = Array.isArray(pool.gpp_tournaments) ? pool.gpp_tournaments[0] : pool.gpp_tournaments
    if (!tournament || pool.is_locked || tournament.status === 'live' || tournament.status === 'completed') continue
    const until = hoursUntil(tournament.start_date)
    if (until === null || until < 0 || until > 36) continue

    const { data: entries } = await supabase
      .from('gpp_entries')
      .select('id, user_id, display_name, golfer_picks, is_removed')
      .eq('pool_id', pool.id)
      .eq('is_removed', false)

    for (const entry of entries || []) {
      if (!entry.user_id) continue
      const pickCount = Array.isArray(entry.golfer_picks) ? entry.golfer_picks.length : 0
      if (pickCount > 0) continue
      const prefs = prefsByUser.get(entry.user_id)
      if (!notificationPrefsAllow(prefs, 'pick_deadline')) continue
      candidates += 1
      const result = await sendOnce({
        userId: entry.user_id,
        poolId: pool.id,
        type: 'pick_deadline',
        dedupeKey: `pick_deadline:${pool.id}:${entry.user_id}:${dateKey(tournament.start_date)}`,
        title: 'Make your Golf Pools Pro picks',
        body: `${pool.name}: picks lock before the first tee time for ${tournament.name || 'the tournament'}.`,
      })
      sent += result.sent
    }
  }
  return { candidates, sent }
}

async function sendLeaderboardLiveAlerts(supabase: any, prefsByUser: Map<string, Prefs>) {
  const { data: pools, error } = await supabase
    .from('gpp_pools')
    .select('id, name, owner_id, gpp_tournaments(name, status, last_scores_fetch)')
    .eq('is_completed', false)
  if (error) throw error

  let sent = 0
  let candidates = 0
  for (const pool of pools || []) {
    const tournament = Array.isArray(pool.gpp_tournaments) ? pool.gpp_tournaments[0] : pool.gpp_tournaments
    if (!hasRecentScores(tournament)) continue
    const { data: entries } = await supabase
      .from('gpp_entries')
      .select('user_id, is_removed')
      .eq('pool_id', pool.id)
      .eq('is_removed', false)
    const userIds = Array.from(new Set([pool.owner_id, ...((entries || []).map((entry: any) => entry.user_id))].filter(Boolean)))
    for (const userId of userIds) {
      const prefs = prefsByUser.get(userId)
      if (!notificationPrefsAllow(prefs, 'leaderboard_live')) continue
      candidates += 1
      const result = await sendOnce({
        userId,
        poolId: pool.id,
        type: 'leaderboard_live',
        dedupeKey: `leaderboard_live:${pool.id}:${userId}`,
        title: 'Leaderboard is live',
        body: `${pool.name}: live scores are updating now.`,
      })
      sent += result.sent
    }
  }
  return { candidates, sent }
}

async function sendLeadChangeAlerts(supabase: any, prefsByUser: Map<string, Prefs>) {
  const { data: pools, error } = await supabase
    .from('gpp_pools')
    .select('id, name, count_scores, ob_rule_enabled, ob_penalty_strokes, gpp_tournaments(name, status, leaderboard_json)')
    .eq('is_completed', false)
  if (error) throw error

  let sent = 0
  let candidates = 0
  for (const pool of pools || []) {
    const tournament = Array.isArray(pool.gpp_tournaments) ? pool.gpp_tournaments[0] : pool.gpp_tournaments
    const leaderboard = Array.isArray(tournament?.leaderboard_json) ? tournament.leaderboard_json as GolfPlayer[] : []
    if (tournament?.status !== 'live' || leaderboard.length === 0) continue
    const { data: entries } = await supabase
      .from('gpp_entries')
      .select('id, user_id, display_name, golfer_picks, is_removed')
      .eq('pool_id', pool.id)
      .eq('is_removed', false)
    const scored = rankEntries((entries || []).map((entry: any) => ({
      ...scoreEntry(Array.isArray(entry.golfer_picks) ? entry.golfer_picks : [], leaderboard, {
        countScores: pool.count_scores || 4,
        obRuleEnabled: Boolean(pool.ob_rule_enabled),
        obPenaltyStrokes: pool.ob_penalty_strokes || 2,
      }),
      entryId: entry.id,
      displayName: entry.display_name || 'Entry',
      userId: entry.user_id,
    }))) as Array<ReturnType<typeof scoreEntry> & { entryId: string; displayName: string; userId?: string; rank?: number | null }>
    const leaders = scored.filter(entry => entry.rank === 1 && entry.userId)
    for (const leader of leaders) {
      const userId = leader.userId!
      const prefs = prefsByUser.get(userId)
      if (!notificationPrefsAllow(prefs, 'took_lead')) continue
      candidates += 1
      const result = await sendOnce({
        userId,
        poolId: pool.id,
        type: 'took_lead',
        dedupeKey: `took_lead:${pool.id}:${userId}:${leader.entryId}`,
        title: 'You are leading your pool',
        body: `${pool.name}: your entry is currently in first place.`,
      })
      sent += result.sent
    }
  }
  return { candidates, sent }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient() as any
  const prefsByUser = await loadPrefs(supabase)
  const pickDeadline = await sendPickDeadlineReminders(supabase, prefsByUser)
  const leaderboardLive = await sendLeaderboardLiveAlerts(supabase, prefsByUser)
  const tookLead = await sendLeadChangeAlerts(supabase, prefsByUser)
  return NextResponse.json({ ok: true, pickDeadline, leaderboardLive, tookLead })
}
