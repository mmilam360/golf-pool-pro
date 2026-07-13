import type { GolfPlayer } from './golf-api'
import { hasOnCourseScores } from './golf-live'
import { hasWeekendCutStatusErrors } from './leaderboard-sanity'
import { DASHBOARD_ACTIVE_POOLS_CACHE_VERSION } from './dashboard-cache'
import { finalPool, poolDashboardStatus } from './pool-state'

export const DASHBOARD_CACHE_MAX_AGE_MS = 5 * 60 * 1000
export const DASHBOARD_LIVE_SCORE_POLL_INTERVAL_MS = 60 * 1000
export const DASHBOARD_METADATA_REFRESH_INTERVAL_MS = 5 * 60 * 1000

export type DashboardPerformanceTournament = {
  external_id?: string | null
  status?: string | null
  start_date?: string | null
  end_date?: string | null
  leaderboard_json?: GolfPlayer[] | null
}

export type DashboardPerformancePool = {
  is_locked?: boolean | null
  is_completed?: boolean | null
  results_finalized_at?: string | null
}

export type DashboardPerformanceCard = {
  pool?: DashboardPerformancePool | null
  tournament?: DashboardPerformanceTournament | null
}

export type DashboardCachedSnapshot<Card extends DashboardPerformanceCard = DashboardPerformanceCard> = {
  version?: number
  cachedAt?: number
  userId?: string | null
  cards?: Card[]
  entriesByPool?: unknown
}

export type DashboardVisibilityState = 'visible' | 'hidden' | 'prerender' | string

export function cachedTournamentStartHasArrived(startDate?: string | null, now = new Date()) {
  if (!startDate) return false
  const dateOnlyMatch = startDate.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (dateOnlyMatch) {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now)
    return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}` <= today
  }

  const parsed = new Date(startDate)
  return Number.isFinite(parsed.getTime()) && parsed.getTime() <= now.getTime()
}

export function cachedDashboardCardHasScoreSanityRisk(card: DashboardPerformanceCard) {
  return hasWeekendCutStatusErrors(card.tournament?.leaderboard_json)
}

export function cachedDashboardCardNeedsScoreUpdateNotice(card: DashboardPerformanceCard, now = new Date()) {
  const tournament = card.tournament
  const status = String(tournament?.status || '').toLowerCase()
  return status === 'live'
    || status === 'completed'
    || cachedTournamentStartHasArrived(tournament?.start_date, now)
    || hasOnCourseScores(tournament?.leaderboard_json)
}

export function cachedDashboardSnapshotNeedsScoreUpdate<Card extends DashboardPerformanceCard>(snapshot: DashboardCachedSnapshot<Card>, now = new Date()) {
  return Array.isArray(snapshot.cards) && snapshot.cards.some(card => cachedDashboardCardNeedsScoreUpdateNotice(card, now))
}

export function cachedDashboardSnapshotIsUsableForUser<Card extends DashboardPerformanceCard>(snapshot: DashboardCachedSnapshot<Card> | null | undefined, userId: string | null | undefined, nowMs = Date.now()) {
  if (!snapshot || !userId) return false
  if (snapshot.version !== DASHBOARD_ACTIVE_POOLS_CACHE_VERSION) return false
  if (snapshot.userId !== userId) return false
  if (!snapshot.cachedAt || nowMs - snapshot.cachedAt > DASHBOARD_CACHE_MAX_AGE_MS) return false
  if (!Array.isArray(snapshot.cards) || snapshot.cards.length === 0) return false
  if (!snapshot.entriesByPool || typeof snapshot.entriesByPool !== 'object' || Array.isArray(snapshot.entriesByPool)) return false
  return !snapshot.cards.some(cachedDashboardCardHasScoreSanityRisk)
}

export function dashboardLiveTournamentExternalIds<Card extends DashboardPerformanceCard>(cards: Card[], now = new Date()) {
  return Array.from(new Set(
    cards
      .filter(card => {
        if (!card.tournament?.external_id) return false
        if (finalPool(card.pool, card.tournament)) return false
        return poolDashboardStatus(card.pool, card.tournament, now) === 'Live'
      })
      .map(card => card.tournament?.external_id)
      .filter((externalId): externalId is string => Boolean(externalId))
  ))
}

export function visibilityAllowsDashboardWork(visibilityState?: DashboardVisibilityState | null) {
  return visibilityState !== 'hidden'
}

export function shouldPollDashboardLiveScores(input: {
  snapshot?: boolean
  visibilityState?: DashboardVisibilityState | null
  online?: boolean
  liveTournamentIds?: readonly string[]
}) {
  return !input.snapshot
    && input.online !== false
    && visibilityAllowsDashboardWork(input.visibilityState)
    && Boolean(input.liveTournamentIds?.length)
}

export function shouldRefreshDashboardMetadata(input: {
  snapshot?: boolean
  visibilityState?: DashboardVisibilityState | null
  online?: boolean
  hasDashboardCards?: boolean
}) {
  return !input.snapshot
    && input.online !== false
    && visibilityAllowsDashboardWork(input.visibilityState)
    && Boolean(input.hasDashboardCards)
}
