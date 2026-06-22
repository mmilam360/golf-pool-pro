import { getPoolPaymentQuote, getPoolPaymentStatus, type PoolPaymentStatus } from './payments/pricing'
import { APP_DATE_TIME_ZONE, getDateOnly, todayDateOnly } from './date-utils'
import type { GolfPlayer } from './golf-api'
import { hasOnCourseScores } from './golf-live'

export const LIVE_SCORE_STALE_MINUTES = 12
export const FIELD_STALE_DAYS = 2

export type TournamentStatus = 'upcoming' | 'live' | 'completed' | string

export type TournamentStateInput = {
  id?: string | null
  name?: string | null
  status?: TournamentStatus | null
  start_date?: string | null
  end_date?: string | null
  leaderboard_json?: unknown
  field_json?: unknown
  last_scores_fetch?: string | null
  last_field_fetch?: string | null
}

export type PoolStateInput = {
  id?: string | null
  name?: string | null
  is_locked?: boolean | null
  is_completed?: boolean | null
  results_finalized_at?: string | null
  payment_status?: PoolPaymentStatus | string | null
  amount_paid_cents?: number | null
  game_format?: string | null
  groups_finalized_at?: string | null
}

export type EntryStateInput = {
  id?: string | null
  pool_id?: string | null
  is_removed?: boolean | null
  golfer_picks?: unknown
  counting_scores?: unknown
  rank?: number | null
  total_score?: number | null
}

export type PaymentState = {
  status: PoolPaymentStatus
  storedStatus: PoolPaymentStatus | string | null | undefined
  activeEntryCount: number
  amountPaidCents: number
  expectedFeeCents: number
  amountDueCents: number
}

export type BoardVisibilityState = 'visible_final' | 'visible_live' | 'visible_pre_scoring'
export type PoolDashboardStatus = 'Passed' | 'Live' | 'Locked' | 'Open'

export type BoardVisibility = {
  state: BoardVisibilityState
  canShowLeaderboard: true
  hiddenByBilling: false
}

export function normalizeTournamentStatus(status?: string | null) {
  return String(status || 'upcoming').toLowerCase()
}

export function tournamentIsLive(tournament?: TournamentStateInput | null) {
  return normalizeTournamentStatus(tournament?.status) === 'live'
}

export function tournamentIsCompleted(tournament?: TournamentStateInput | null) {
  return normalizeTournamentStatus(tournament?.status) === 'completed'
}

export function jsonRows(value: unknown) {
  return Array.isArray(value) ? value : []
}

export function hasStoredLeaderboard(tournament?: TournamentStateInput | null) {
  return jsonRows(tournament?.leaderboard_json).length > 0
}

export function tournamentHasOnCourseScores(tournament?: TournamentStateInput | null) {
  return hasOnCourseScores(jsonRows(tournament?.leaderboard_json) as GolfPlayer[])
}

export function tournamentDateWindowIncludes(tournament?: TournamentStateInput | null, now = new Date()) {
  const startDate = getDateOnly(tournament?.start_date || '')
  if (!startDate) return false
  const today = todayDateOnly(APP_DATE_TIME_ZONE, now)
  const endDate = getDateOnly(tournament?.end_date || '')
  return endDate ? startDate <= today && today <= endDate : startDate <= today
}

export function tournamentIsInProgress(tournament?: TournamentStateInput | null, now = new Date()) {
  if (tournamentIsLive(tournament)) return true
  if (tournamentHasOnCourseScores(tournament)) return true
  return tournamentDateWindowIncludes(tournament, now) && hasStoredLeaderboard(tournament)
}

export function tournamentHasScoringEvidence(tournament?: TournamentStateInput | null, now = new Date()) {
  return tournamentIsLive(tournament) || tournamentIsCompleted(tournament) || tournamentHasOnCourseScores(tournament) || tournamentIsInProgress(tournament, now)
}

export function finalPool(pool?: PoolStateInput | null, tournament?: TournamentStateInput | null) {
  return Boolean(pool?.is_completed || pool?.results_finalized_at || tournamentIsCompleted(tournament))
}

export function lockedOrScoring(pool?: PoolStateInput | null, tournament?: TournamentStateInput | null) {
  return Boolean(pool?.is_locked || finalPool(pool, tournament) || tournamentHasScoringEvidence(tournament))
}

export function poolDashboardStatus(pool?: PoolStateInput | null, tournament?: TournamentStateInput | null, now = new Date()): PoolDashboardStatus {
  if (finalPool(pool, tournament)) return 'Passed'
  if (tournamentIsInProgress(tournament, now)) return 'Live'
  if (pool?.is_locked) return 'Locked'
  return 'Open'
}

export function poolIsActiveForDashboard(pool?: PoolStateInput | null, tournament?: TournamentStateInput | null, now = new Date()) {
  if (finalPool(pool, tournament)) return false
  if (tournamentIsInProgress(tournament, now)) return true
  if (!tournament?.start_date) return true

  const today = todayDateOnly(APP_DATE_TIME_ZONE, now)
  const startDate = getDateOnly(tournament.start_date) || tournament.start_date
  const endDate = getDateOnly(tournament.end_date || '')
  if (endDate) return today <= endDate
  return startDate >= today
}

export function picksAreVisibleForPool(pool?: PoolStateInput | null, tournament?: TournamentStateInput | null, now = new Date()) {
  return Boolean(pool?.is_locked || tournamentHasScoringEvidence(tournament, now))
}

export function derivePaymentState(input: {
  storedStatus?: PoolPaymentStatus | string | null
  activeEntryCount: number
  amountPaidCents?: number | null
  hasLifetimeAccess?: boolean
}): PaymentState {
  const amountPaidCents = Number(input.amountPaidCents || 0)
  const quote = getPoolPaymentQuote(input.activeEntryCount, amountPaidCents, Boolean(input.hasLifetimeAccess))
  return {
    status: getPoolPaymentStatus(input.storedStatus, input.activeEntryCount, amountPaidCents, Boolean(input.hasLifetimeAccess)),
    storedStatus: input.storedStatus,
    activeEntryCount: input.activeEntryCount,
    amountPaidCents,
    expectedFeeCents: Number(quote.tierAmountCents || 0),
    amountDueCents: Number(quote.amountDueCents || 0),
  }
}

export function deriveBoardVisibility(input: { pool?: PoolStateInput | null; tournament?: TournamentStateInput | null }): BoardVisibility {
  if (finalPool(input.pool, input.tournament)) {
    return { state: 'visible_final', canShowLeaderboard: true, hiddenByBilling: false }
  }
  if (tournamentHasScoringEvidence(input.tournament)) {
    return { state: 'visible_live', canShowLeaderboard: true, hiddenByBilling: false }
  }
  return { state: 'visible_pre_scoring', canShowLeaderboard: true, hiddenByBilling: false }
}

export function activeEntries<T extends EntryStateInput>(entries: T[] | null | undefined) {
  return (entries || []).filter(entry => !entry.is_removed)
}

export function entryHasSubmittedPicks(entry: EntryStateInput) {
  return Array.isArray(entry.golfer_picks) && entry.golfer_picks.some(pick => typeof pick === 'string' ? pick.trim().length > 0 : Boolean(pick))
}

export function entriesMissingFrozenResults<T extends EntryStateInput>(entries: T[] | null | undefined) {
  return activeEntries(entries).filter(entry => {
    if (!entryHasSubmittedPicks(entry)) return false
    return !Array.isArray(entry.counting_scores) || entry.counting_scores.length === 0 || entry.rank == null || entry.total_score == null
  })
}

export function daysFromToday(dateLike?: string | null, now = new Date()) {
  if (!dateLike) return null
  const date = new Date(`${String(dateLike).slice(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(date.getTime())) return null
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return Math.round((date.getTime() - today.getTime()) / 86_400_000)
}

export function minutesAgo(dateLike?: string | null, now = new Date()) {
  if (!dateLike) return null
  const time = new Date(dateLike).getTime()
  if (!Number.isFinite(time)) return null
  return Math.round((now.getTime() - time) / 60_000)
}

export function fieldAgeDays(tournament?: TournamentStateInput | null, now = new Date()) {
  if (!tournament?.last_field_fetch) return null
  const time = new Date(tournament.last_field_fetch).getTime()
  if (!Number.isFinite(time)) return null
  return Math.round((now.getTime() - time) / 86_400_000)
}

export function upcomingFieldReadinessWindow(tournament?: TournamentStateInput | null, fieldWindowDays = 14, now = new Date()) {
  const startDays = daysFromToday(tournament?.start_date, now)
  return startDays != null && startDays >= 0 && startDays <= fieldWindowDays
}

export function groupedPoolNeedsGroups(pool?: PoolStateInput | null) {
  return (pool?.game_format === 'ranked_groups' || pool?.game_format === 'random_groups') && !pool?.groups_finalized_at
}

export function liveScoresAreStale(tournament?: TournamentStateInput | null, staleMinutes = LIVE_SCORE_STALE_MINUTES, now = new Date()) {
  const age = minutesAgo(tournament?.last_scores_fetch, now)
  return age == null || age > staleMinutes
}
