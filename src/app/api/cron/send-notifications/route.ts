import { createServiceClient } from '@/lib/supabase/service'
import { scoreEntriesForLeaderboard } from '@/lib/scoring'
import { hasOnCourseScores } from '@/lib/golf-live'
import { notificationPrefsAllow, recordNotificationEvent, sendPushToUser } from '@/lib/notifications/push'
import { runCronRoute } from '@/lib/cron-run-log'
import type { GolfPlayer } from '@/lib/golf-api'
import { hasWeekendCutStatusErrors } from '@/lib/leaderboard-sanity'
import { totalPicksRequired } from '@/lib/pick-counts'
import { reserveEmailEvent, finishEmailEvent } from '@/lib/email-events'
import { entryRecipientEmail, siteOrigin } from '@/lib/pool-email-recipients'
import { sendMissingPicksReminderEmail } from '@/lib/pool-transactional-emails'

export const runtime = 'nodejs'

type Prefs = { user_id: string; pick_deadline?: boolean; leaderboard_live?: boolean; took_lead?: boolean }
type NotificationTournament = { id: string; name?: string | null; status?: string | null; last_scores_fetch?: string | null; leaderboard_json?: GolfPlayer[] | null }

function dateKey(value?: string | null) {
  return value ? value.split('T')[0] : new Date().toISOString().slice(0, 10)
}

function hoursUntil(value?: string | null) {
  if (!value) return null
  const ms = new Date(value).getTime() - Date.now()
  if (!Number.isFinite(ms)) return null
  return ms / (60 * 60 * 1000)
}

function hoursUntilDate(value: Date) {
  const ms = value.getTime() - Date.now()
  if (!Number.isFinite(ms)) return null
  return ms / (60 * 60 * 1000)
}

function pickDeadlineAt(pool: any) {
  if (!pool?.lock_at) return null
  const deadline = new Date(pool.lock_at)
  return Number.isFinite(deadline.getTime()) ? deadline : null
}

function shouldSendMissingPicksEmailNow(pool: any) {
  const deadline = pickDeadlineAt(pool)
  if (!deadline) return false
  const until = hoursUntilDate(deadline)
  return until !== null && until > 23 && until <= 24
}

function emailDateKey(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : dateKey()
}

function hasRecentScores(tournament: any) {
  if (tournament?.status !== 'live' || !tournament.last_scores_fetch) return false
  if (!hasOnCourseScores(Array.isArray(tournament.leaderboard_json) ? tournament.leaderboard_json : [])) return false
  if (hasWeekendCutStatusErrors(Array.isArray(tournament.leaderboard_json) ? tournament.leaderboard_json : [])) return false
  const lastFetchMs = new Date(tournament.last_scores_fetch).getTime()
  return Number.isFinite(lastFetchMs) && Date.now() - lastFetchMs <= 10 * 60 * 1000
}

async function loadPrefs(supabase: any) {
  const { data } = await supabase.from('gpp_notification_preferences').select('*')
  return new Map<string, Prefs>((data || []).map((pref: Prefs) => [pref.user_id, pref]))
}

async function loadLiveTournamentBoards(supabase: any) {
  const { data, error } = await supabase
    .from('gpp_tournaments')
    .select('id, name, status, last_scores_fetch, leaderboard_json')
    .eq('status', 'live')
    .limit(50)
  if (error) throw error
  return new Map<string, NotificationTournament>((data || []).map((tournament: NotificationTournament) => [tournament.id, tournament]))
}

async function loadPoolsForTournamentBoards(supabase: any, tournamentIds: string[], columns: string) {
  if (tournamentIds.length === 0) return []
  const { data, error } = await supabase
    .from('gpp_pools')
    .select(columns)
    .in('tournament_id', tournamentIds)
    .eq('is_completed', false)
  if (error) throw error
  return data || []
}

async function sendOnce(params: {
  supabase: any
  userId: string
  poolId: string
  type: 'pick_deadline' | 'leaderboard_live' | 'took_lead'
  dedupeKey: string
  title: string
  body: string
}) {
  const { data: subscriptions, error: subscriptionError } = await params.supabase
    .from('gpp_push_subscriptions')
    .select('id')
    .eq('user_id', params.userId)
    .limit(1)
  if (subscriptionError) throw subscriptionError
  if (!subscriptions?.length) return { sent: 0, duplicate: false, noSubscription: true }

  const inserted = await recordNotificationEvent({
    userId: params.userId,
    poolId: params.poolId,
    type: params.type,
    dedupeKey: params.dedupeKey,
    payload: { title: params.title, body: params.body },
  })
  if (!inserted) return { sent: 0, duplicate: true, noSubscription: false }
  const result = await sendPushToUser(params.userId, {
    title: params.title,
    body: params.body,
    url: `/pool/${params.poolId}`,
    tag: params.dedupeKey,
  })
  return { sent: result.sent, duplicate: false, noSubscription: false }
}

async function sendPickDeadlineReminders(supabase: any, prefsByUser: Map<string, Prefs>) {
  const { data: pools, error } = await supabase
    .from('gpp_pools')
    .select('id, name, is_locked, owner_id, lock_at, pick_count, count_scores, game_format, group_count, picks_per_group, pick_groups_json, gpp_tournaments(name, start_date, status)')
    .eq('is_completed', false)
  if (error) throw error

  let sent = 0
  let candidates = 0
  let emailSent = 0
  let emailCandidates = 0
  let emailSkipped = 0
  let emailDuplicate = 0
  let emailNoRecipient = 0
  const origin = siteOrigin()

  for (const pool of pools || []) {
    const tournament = Array.isArray(pool.gpp_tournaments) ? pool.gpp_tournaments[0] : pool.gpp_tournaments
    if (!tournament || pool.is_locked || tournament.status === 'live' || tournament.status === 'completed') continue

    const pushUntil = hoursUntil(tournament.start_date)
    const shouldSendPush = pushUntil !== null && pushUntil >= 0 && pushUntil <= 36
    const deadline = pickDeadlineAt(pool)
    const shouldSendEmail = shouldSendMissingPicksEmailNow(pool)
    if (!shouldSendPush && !shouldSendEmail) continue

    const { data: entries } = await supabase
      .from('gpp_entries')
      .select('id, user_id, display_name, notification_email, golfer_picks, is_removed')
      .eq('pool_id', pool.id)
      .eq('is_removed', false)

    const requiredPickCount = totalPicksRequired(pool)
    for (const entry of entries || []) {
      const pickCount = Array.isArray(entry.golfer_picks) ? entry.golfer_picks.length : 0
      if (pickCount >= requiredPickCount) continue

      if (entry.user_id && shouldSendPush) {
        const prefs = prefsByUser.get(entry.user_id)
        if (notificationPrefsAllow(prefs, 'pick_deadline')) {
          candidates += 1
          const result = await sendOnce({
            supabase,
            userId: entry.user_id,
            poolId: pool.id,
            type: 'pick_deadline',
            dedupeKey: `pick_deadline:${pool.id}:${entry.user_id}:${dateKey(tournament.start_date)}`,
            title: 'Picks are due soon',
            body: `${pool.name}: get your golfers in before the first tee time.`,
          })
          sent += result.sent
        }
      }

      if (!shouldSendEmail) continue
      emailCandidates += 1
      const recipient = await entryRecipientEmail(supabase, entry)
      if (!recipient) {
        emailNoRecipient += 1
        continue
      }

      const event = await reserveEmailEvent(supabase, {
        poolId: pool.id,
        entryId: entry.id,
        emailType: 'missing_picks_reminder',
        dedupeKey: `missing_picks:${pool.id}:${entry.id}:${emailDateKey(deadline)}`,
        recipient,
        payload: { poolName: pool.name, entryName: entry.display_name, pickCount, requiredPickCount },
      })
      if (!event.reserved) {
        emailDuplicate += 1
        continue
      }

      try {
        const result = await sendMissingPicksReminderEmail({
          supabase,
          origin,
          recipient,
          pool,
          tournament,
          entry,
          pickCount,
          requiredPickCount,
        })
        if ((result as any)?.sent === false || (result as any)?.skipped) {
          emailSkipped += 1
          await finishEmailEvent(supabase, event.id, 'skipped', JSON.stringify(result).slice(0, 300))
        } else {
          emailSent += 1
          await finishEmailEvent(supabase, event.id, 'sent')
        }
      } catch (error: any) {
        emailSkipped += 1
        await finishEmailEvent(supabase, event.id, 'failed', error?.message || 'Email failed')
      }
    }
  }
  return { candidates, sent, emailCandidates, emailSent, emailSkipped, emailDuplicate, emailNoRecipient }
}

async function sendLeaderboardLiveAlerts(supabase: any, prefsByUser: Map<string, Prefs>, liveTournaments: Map<string, NotificationTournament>) {
  const tournamentsById = new Map(
    [...liveTournaments.entries()].filter(([, tournament]) => hasRecentScores(tournament))
  )
  const pools = await loadPoolsForTournamentBoards(
    supabase,
    [...tournamentsById.keys()],
    'id, name, owner_id, tournament_id'
  )

  let sent = 0
  let candidates = 0
  for (const pool of pools || []) {
    const tournament = tournamentsById.get(pool.tournament_id)
    if (!tournament) continue
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
        supabase,
        userId,
        poolId: pool.id,
        type: 'leaderboard_live',
        dedupeKey: `leaderboard_live:${pool.id}:${userId}`,
        title: 'Scores are live',
        body: 'The board is moving. Time to watch your picks.',
      })
      sent += result.sent
    }
  }
  return { candidates, sent }
}

async function sendLeadChangeAlerts(supabase: any, prefsByUser: Map<string, Prefs>, liveTournaments: Map<string, NotificationTournament>) {
  const tournamentsById = new Map(
    [...liveTournaments.entries()].filter(([, tournament]) => {
      const leaderboard = Array.isArray(tournament.leaderboard_json) ? tournament.leaderboard_json : []
      return leaderboard.length > 0 && !hasWeekendCutStatusErrors(leaderboard)
    })
  )
  const pools = await loadPoolsForTournamentBoards(
    supabase,
    [...tournamentsById.keys()],
    'id, name, pick_count, count_scores, ob_rule_enabled, ob_penalty_strokes, tournament_id'
  )

  let sent = 0
  let candidates = 0
  for (const pool of pools || []) {
    const tournament = tournamentsById.get(pool.tournament_id)
    const leaderboard = Array.isArray(tournament?.leaderboard_json) ? tournament.leaderboard_json as GolfPlayer[] : []
    if (leaderboard.length === 0) continue
    const { data: entryRows } = await supabase
      .from('gpp_entries')
      .select('id, user_id, display_name, golfer_picks, is_removed')
      .eq('pool_id', pool.id)
      .eq('is_removed', false)
    const entries = entryRows || []
    const scored = scoreEntriesForLeaderboard(entries, leaderboard, {
      countScores: pool.count_scores || pool.pick_count || 0,
      obRuleEnabled: Boolean(pool.ob_rule_enabled),
      obPenaltyStrokes: pool.ob_penalty_strokes ?? 2,
    })
    const userIdByEntryId = new Map(entries.map((entry: any) => [entry.id, entry.user_id]))
    const leaders = scored.filter(entry => entry.rank === 1 && userIdByEntryId.get(entry.entryId))
    for (const leader of leaders) {
      const userId = userIdByEntryId.get(leader.entryId) as string
      const prefs = prefsByUser.get(userId)
      if (!notificationPrefsAllow(prefs, 'took_lead')) continue
      candidates += 1
      const result = await sendOnce({
        supabase,
        userId,
        poolId: pool.id,
        type: 'took_lead',
        dedupeKey: `took_lead:${pool.id}:${userId}:${leader.entryId}`,
        title: "You're at the top",
        body: `${pool.name}: your entry is first on the board.`,
      })
      sent += result.sent
    }
  }
  return { candidates, sent }
}

export async function GET(request: Request) {
  return runCronRoute(request, async () => {
    const supabase = createServiceClient() as any
    const prefsByUser = await loadPrefs(supabase)
    const liveTournaments = await loadLiveTournamentBoards(supabase)
    const pickDeadline = await sendPickDeadlineReminders(supabase, prefsByUser)
    const leaderboardLive = await sendLeaderboardLiveAlerts(supabase, prefsByUser, liveTournaments)
    const tookLead = await sendLeadChangeAlerts(supabase, prefsByUser, liveTournaments)
    return { pickDeadline, leaderboardLive, tookLead }
  })
}
