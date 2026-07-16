'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { availableCompletedRounds, buildHarePickMap, buildTortoisePickMap, currentLeaderboardRound, entryMovementSincePriorRank, leaderboardForCompletedRound, leaderboardForRoundOnly, leaderboardHasPlayoffScores, normalizePickName, scoreEntriesForLeaderboard, type EntryMovement, type PickScore, type ScoredEntry } from '@/lib/scoring'
import { LeverageMarker, LeverageMarkerCorner, LeverageMarkerLegend, ObMarker, ObMarkerCorner } from '@/components/LeverageMarkers'
import { hasOnCourseScores } from '@/lib/golf-live'
import { formatDateOnly } from '@/lib/date-utils'
import { leaderboardBackedPickProgressLabel } from '@/lib/golfer-status'
import { groupForPick, type PickGroup } from '@/lib/pool-formats'
import { TournamentLeaderboard } from '@/components/TournamentLeaderboard'
import { displayTournamentName } from '@/lib/tournament-name'
import { isGroupedPoolFormat, totalPicksRequired } from '@/lib/pick-counts'
import { pickGridColumnCount } from '@/lib/pick-card-layout'
import { getPickLockBadgeText } from '@/lib/pick-lock-display'
import { applySavedPoolOrder, movePoolId } from '@/lib/dashboard-pool-order'
import { trackGppEvent } from '@/lib/posthog-events'
import { frozenResultsForEntries, hasCompleteFrozenResults } from '@/lib/frozen-results'
import { poolDashboardStatus, tournamentIsInProgress as sharedTournamentIsInProgress, tournamentHasScoringEvidence } from '@/lib/pool-state'
import { DASHBOARD_ACTIVE_POOLS_CACHE_VERSION, dashboardActivePoolsCacheStorageKey } from '@/lib/dashboard-cache'
import {
  DASHBOARD_LIVE_SCORE_POLL_INTERVAL_MS,
  DASHBOARD_METADATA_REFRESH_INTERVAL_MS,
  dashboardMissingLiveTournamentExternalIds,
  dashboardLiveTournamentExternalIds,
  shouldPollDashboardLiveScores,
  shouldRefreshDashboardMetadata,
  type DashboardVisibilityState,
} from '@/lib/dashboard-performance'
import type { GolfCutLine, GolfPlayer } from '@/lib/golf-api'

type Tournament = {
  name?: string | null
  external_id?: string | null
  start_date?: string | null
  end_date?: string | null
  status?: string | null
  field_json?: GolfPlayer[] | null
  leaderboard_json?: GolfPlayer[] | null
  last_scores_fetch?: string | null
  cutLine?: GolfCutLine | null
}

type PoolRecord = {
  id: string
  name: string
  passcode: string
  is_locked: boolean | null
  is_completed: boolean | null
  payment_status?: string | null
  amount_paid_cents?: number | null
  pick_count?: number | null
  count_scores?: number | null
  ob_rule_enabled?: boolean | null
  ob_penalty_strokes?: number | null
  game_format?: string | null
  group_count?: number | null
  picks_per_group?: number | null
  pick_groups_json?: unknown | null
  lock_at?: string | null
  groups_finalized_at?: string | null
  gpp_tournaments?: Tournament | Tournament[] | null
}

type EntryRecord = {
  id: string
  pool_id: string
  display_name: string | null
  golfer_picks: unknown
  counting_scores?: unknown
  total_score?: number | null
  rank?: number | null
  is_removed?: boolean | null
  picks_hidden?: boolean | null
  gpp_pools?: PoolRecord | PoolRecord[] | null
}

type ActivePoolCard = {
  pool: PoolRecord
  tournament: Tournament | null
  role: string
  entry: EntryRecord | null
}

type LiveTournamentPayload = {
  leaderboard?: GolfPlayer[] | null
  cutLine?: GolfCutLine | null
  lastScoresFetch?: string | null
}

type RankPreview = {
  rank: number | null
  totalScore: number | null
  todayScore: number | null
  movementToday: EntryMovement | null
}

const DEFAULT_TEE_TIME_ZONE = 'America/New_York'
const DASHBOARD_POOL_ORDER_STORAGE_KEY = 'gpp-dashboard-active-pool-order'

type LeaderboardMode = { type: 'current' } | { type: 'thru'; round: number } | { type: 'day'; round: number }

type DashboardActivePoolsViewState = {
  expandedPoolIds?: string[]
  expandedEntryIds?: Record<string, string[]>
  leaderboardModes?: Record<string, LeaderboardMode>
  scrollAnchorKey?: string
  scrollAnchorOffset?: number
  scrollX?: number
  scrollY?: number
  scrollSavedAt?: number
  savedAt?: number
}

const DASHBOARD_ACTIVE_POOLS_VIEW_STATE_KEY_PREFIX = 'gpp-dashboard-active-pools-view-state-v1'
const DASHBOARD_ACTIVE_POOLS_VIEW_STATE_MAX_AGE_MS = 6 * 60 * 60 * 1000
const DASHBOARD_SCROLL_RESTORE_MAX_AGE_MS = 8000

function dashboardActivePoolsViewStateKey(mode: 'player' | 'runner') {
  return `${DASHBOARD_ACTIVE_POOLS_VIEW_STATE_KEY_PREFIX}:${mode}`
}

function readDashboardActivePoolsViewState(storageKey: string): DashboardActivePoolsViewState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DashboardActivePoolsViewState | null
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    if (parsed.savedAt && Date.now() - parsed.savedAt > DASHBOARD_ACTIVE_POOLS_VIEW_STATE_MAX_AGE_MS) {
      window.sessionStorage.removeItem(storageKey)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeDashboardActivePoolsViewState(storageKey: string, patch: Partial<DashboardActivePoolsViewState>) {
  if (typeof window === 'undefined') return
  try {
    const current = readDashboardActivePoolsViewState(storageKey) ?? {}
    window.sessionStorage.setItem(storageKey, JSON.stringify({ ...current, ...patch, savedAt: Date.now() }))
  } catch {
    // Some restricted browser modes block session storage. The dashboard still works without it.
  }
}

function serializeExpandedEntryIds(expandedEntryIds: Record<string, Set<string>>) {
  return Object.fromEntries(Object.entries(expandedEntryIds).map(([poolId, entryIds]) => [poolId, [...entryIds]]))
}

function initialExpandedPoolIds(cards: ActivePoolCard[], storageKey: string) {
  const activePoolIds = new Set(cards.map(card => card.pool.id))
  const storedPoolIds = readDashboardActivePoolsViewState(storageKey)?.expandedPoolIds
  if (Array.isArray(storedPoolIds)) return new Set(storedPoolIds.filter(poolId => activePoolIds.has(poolId)))
  return new Set(cards[0]?.pool.id ? [cards[0].pool.id] : [])
}

function initialExpandedEntryIds(cards: ActivePoolCard[], storageKey: string) {
  const activePoolIds = new Set(cards.map(card => card.pool.id))
  const storedEntryIds = readDashboardActivePoolsViewState(storageKey)?.expandedEntryIds
  if (!storedEntryIds) return {}
  const next: Record<string, Set<string>> = {}
  for (const [poolId, entryIds] of Object.entries(storedEntryIds)) {
    if (activePoolIds.has(poolId) && Array.isArray(entryIds)) next[poolId] = new Set(entryIds)
  }
  return next
}

function storedLeaderboardMode(storageKey: string, poolId: string): LeaderboardMode | null {
  const mode = readDashboardActivePoolsViewState(storageKey)?.leaderboardModes?.[poolId]
  if (!mode || typeof mode !== 'object') return null
  if (mode.type === 'current') return { type: 'current' }
  if ((mode.type === 'thru' || mode.type === 'day') && Number.isInteger(mode.round)) return { type: mode.type, round: mode.round }
  return null
}

function writeDashboardLeaderboardMode(storageKey: string, poolId: string, mode: LeaderboardMode) {
  const currentModes = readDashboardActivePoolsViewState(storageKey)?.leaderboardModes ?? {}
  writeDashboardActivePoolsViewState(storageKey, { leaderboardModes: { ...currentModes, [poolId]: mode } })
}

function currentDashboardScrollAnchor() {
  if (typeof document === 'undefined') return null
  const anchors = Array.from(document.querySelectorAll<HTMLElement>('[data-dashboard-scroll-anchor]'))
    .map(element => ({ element, rect: element.getBoundingClientRect(), key: element.dataset.dashboardScrollAnchor || '' }))
    .filter(anchor => anchor.key && anchor.rect.height > 0)
  if (anchors.length === 0) return null

  const topBoundary = 80
  const visibleBeforeTop = anchors
    .filter(anchor => anchor.rect.top <= topBoundary && anchor.rect.bottom > 0)
    .sort((a, b) => b.rect.top - a.rect.top)[0]
  const visibleAfterTop = anchors
    .filter(anchor => anchor.rect.top > topBoundary)
    .sort((a, b) => a.rect.top - b.rect.top)[0]
  const anchor = visibleBeforeTop || visibleAfterTop || anchors.at(-1)
  if (!anchor) return null
  return { key: anchor.key, offset: anchor.rect.top }
}

function findDashboardScrollAnchor(key: string) {
  if (typeof document === 'undefined') return null
  return Array.from(document.querySelectorAll<HTMLElement>('[data-dashboard-scroll-anchor]'))
    .find(element => element.dataset.dashboardScrollAnchor === key) || null
}

function scheduleDashboardScrollRestore(scrollY?: number, scrollX = 0, anchorKey?: string, anchorOffset?: number) {
  if (typeof window === 'undefined' || typeof scrollY !== 'number' || !Number.isFinite(scrollY)) return
  let attempts = 0
  const restore = () => {
    const anchor = anchorKey ? findDashboardScrollAnchor(anchorKey) : null
    if (anchor && typeof anchorOffset === 'number' && Number.isFinite(anchorOffset)) {
      const delta = anchor.getBoundingClientRect().top - anchorOffset
      if (Math.abs(delta) > 1) window.scrollBy(0, delta)
    } else if (Math.abs(window.scrollY - scrollY) > 1) {
      window.scrollTo(scrollX, scrollY)
    }
    attempts += 1
    if (attempts < 14) window.setTimeout(restore, attempts < 4 ? 0 : 140)
  }
  window.requestAnimationFrame(() => window.requestAnimationFrame(restore))
}

function restoreSavedDashboardScroll(storageKey: string) {
  const stored = readDashboardActivePoolsViewState(storageKey)
  if (!stored?.scrollSavedAt || Date.now() - stored.scrollSavedAt > DASHBOARD_SCROLL_RESTORE_MAX_AGE_MS) return
  scheduleDashboardScrollRestore(stored.scrollY, stored.scrollX ?? 0, stored.scrollAnchorKey, stored.scrollAnchorOffset)
}

function saveDashboardScrollPosition(storageKey: string) {
  const scrollX = window.scrollX
  const scrollY = window.scrollY
  const anchor = currentDashboardScrollAnchor()
  writeDashboardActivePoolsViewState(storageKey, {
    scrollX,
    scrollY,
    scrollAnchorKey: anchor?.key,
    scrollAnchorOffset: anchor?.offset,
    scrollSavedAt: Date.now(),
  })
  return { scrollX, scrollY, anchorKey: anchor?.key, anchorOffset: anchor?.offset }
}

function roundMenuLabel(round: number) {
  return `R${round}`
}

function roundScoreLabel(round: number) {
  return `R${round}`
}

function isFinalRound(round: number, hasPlayoffScores: boolean) {
  return round === 4 && !hasPlayoffScores
}

function cumulativeRoundLabel(round: number, hasPlayoffScores: boolean) {
  return isFinalRound(round, hasPlayoffScores) ? 'Final' : `Through ${roundMenuLabel(round)}`
}

function selectedBoardLabel(mode: LeaderboardMode, hasPlayoffScores: boolean) {
  if (mode.type === 'current') return 'Current'
  if (mode.type === 'thru') return cumulativeRoundLabel(mode.round, hasPlayoffScores)
  return roundMenuLabel(mode.round)
}

function historicalBoardCaption(mode: LeaderboardMode, hasPlayoffScores: boolean) {
  if (mode.type === 'current') return null
  if (mode.type === 'day') return `${roundMenuLabel(mode.round)} scores only`
  return isFinalRound(mode.round, hasPlayoffScores) ? 'Final standings' : `Standings through ${roundMenuLabel(mode.round)}`
}

function tournamentIsInProgress(tournament: Tournament | null) {
  return sharedTournamentIsInProgress(tournament)
}

function statusLabel(pool: PoolRecord, tournament: Tournament | null) {
  return poolDashboardStatus(pool, tournament)
}

function statusClass(label: string) {
  if (label === 'Live') return 'border-[#1f6b4a] bg-[#123c2f] text-white'
  if (label === 'Locked') return 'border-[#b58a3a] bg-[#fbf0c9] text-[#7a5a19]'
  if (label === 'Passed') return 'border-[#d8cab0] bg-[#f3ede0] text-[#657168]'
  return 'border-[#cfe0d3] bg-[#eef7ef] text-[#1f6b4a]'
}

function hasRecentScores(tournament: Tournament | null, nowMs?: number | null) {
  if (!tournament?.last_scores_fetch) return false
  if (!hasOnCourseScores(tournament.leaderboard_json)) return false
  const lastFetchMs = new Date(tournament.last_scores_fetch).getTime()
  if (!Number.isFinite(lastFetchMs)) return false
  if (!nowMs) return false
  return nowMs - lastFetchMs <= 5 * 60 * 1000
}

function hasEventBegun(tournament: Tournament | null) {
  if (tournament?.status === 'completed') return true
  if (tournamentIsInProgress(tournament)) return true
  return false
}

function LockGlyph({ locked }: { locked: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="square" strokeLinejoin="miter">
      <rect x="5" y="10" width="14" height="10" />
      {locked ? <path d="M8 10V7a4 4 0 0 1 8 0v3" /> : <path d="M8 10V7a4 4 0 0 1 7.2-2.4" />}
    </svg>
  )
}

function StatusBadge({ label, locked }: { label: string; locked: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap border px-1.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] sm:gap-1.5 sm:px-2 sm:text-xs sm:tracking-[0.12em] ${statusClass(label)}`}>
      {label === 'Passed' ? null : <LockGlyph locked={locked || label === 'Live'} />}
      {label}
    </span>
  )
}

function LiveScoreStrip({ pulsing = false }: { pulsing?: boolean }) {
  return (
    <div className="mt-0.5 flex w-full items-center justify-center gap-1 border-t border-[#f0c8c3] bg-[#fff1ef] px-1 py-[2px] text-[8px] font-black uppercase leading-none tracking-[0.08em] text-[#b21e23] sm:text-[9px]">
      <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
        {pulsing ? <span className="absolute inline-flex h-full w-full animate-ping bg-[#b21e23] opacity-60" /> : null}
        <span className="relative inline-flex h-full w-full bg-[#b21e23]" />
      </span>
      Live
    </div>
  )
}

function scoreBadgeClass(score: number | null | undefined) {
  if (typeof score === 'number' && score < 0) return 'border-[#b21e23] bg-[#fff1ef] text-[#b21e23]'
  return 'border-[#d8cab0] bg-white text-[#111]'
}

function formatScoreFreshness(value?: string | null, nowMs?: number | null) {
  if (!value) return null
  const updatedMs = new Date(value).getTime()
  if (!Number.isFinite(updatedMs)) return null
  if (!nowMs) return null
  const diffSeconds = Math.max(0, Math.floor((nowMs - updatedMs) / 1000))
  if (diffSeconds < 60) return 'Updated just now'
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `Updated ${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `Updated ${diffHours}h ago`
  return `Updated ${Math.floor(diffHours / 24)}d ago`
}

function priorCompletedRoundForMovement(leaderboard: GolfPlayer[]) {
  const completedRounds = availableCompletedRounds(leaderboard)
  if (!completedRounds.length) return null
  const roundNumbers = new Set<number>()
  for (const player of leaderboard) {
    for (const round of player.roundScores || []) {
      roundNumbers.add(round.round)
    }
  }
  const incompleteRounds = Array.from(roundNumbers)
    .filter(roundNumber => leaderboard.some(player => player.roundScores?.some(round => round.round === roundNumber && !round.complete)))
    .sort((a, b) => a - b)
  const currentRound = incompleteRounds.length ? Math.max(...incompleteRounds) : Math.max(...completedRounds)
  const priorRound = currentRound - 1
  return completedRounds.includes(priorRound) ? priorRound : null
}

function MovementArrow({ movement }: { movement: EntryMovement }) {
  if (movement.direction === 'none') return null
  const up = movement.direction === 'up'
  return (
    <span className={`inline-flex items-baseline gap-0.5 align-baseline ${up ? 'text-[#1f6b4a]' : 'text-[#b21e23]'}`}>
      <span aria-hidden="true" className="text-[9px] leading-none sm:text-[10px]">{up ? '▲' : '▼'}</span>
      <span>{movement.spots}</span>
    </span>
  )
}

function MovementBadge({ movement }: { movement: EntryMovement | null }) {
  if (!movement || movement.direction === 'none') return null
  const up = movement.direction === 'up'
  return <span className={`inline-flex items-center border-2 px-2 py-1 text-[11px] font-black leading-none ${up ? 'border-[#1f6b4a] bg-[#eef7ef] text-[#1f6b4a]' : 'border-[#b21e23] bg-[#fff1ef] text-[#b21e23]'}`}><MovementArrow movement={movement} /></span>
}

function TodayMovementBadge({ label, score, movement }: { label: string | null; score: number | null; movement: EntryMovement | null }) {
  if (!label || score === null) return <MovementBadge movement={movement} />
  return (
    <span className="inline-flex items-center gap-1 border-2 border-[#d8cab0] bg-[#fbf7ed] px-2 py-1 text-[11px] font-black leading-none text-[#111]">
      <span className="text-[#657168]">{label}</span>
      <span className={scoreClass(score)}>{formatScore(score)}</span>
      {movement && movement.direction !== 'none' ? <span className="text-[#657168]">/</span> : null}
      {movement && movement.direction !== 'none' ? <MovementArrow movement={movement} /> : null}
    </span>
  )
}

function formatScore(score: number | null) {
  if (score === null) return '—'
  if (score === 0) return 'E'
  return score > 0 ? `+${score}` : String(score)
}

function formatPickScore(pick?: PickScore | null) {
  if (!pick) return ''
  if (pick.scoreToPar === null) return '—'
  return formatScore(pick.scoreToPar)
}

function formatEntryCount(count: number) {
  return `${count} ${count === 1 ? 'entry' : 'entries'}`
}

function scoreClass(score: number | null) {
  if (score === null) return 'text-stone-400'
  return score < 0 ? 'text-[#b21e23]' : 'text-[#111]'
}

function ownEntryRowBg(isOwnEntry: boolean) {
  return isOwnEntry ? 'bg-[#eaf5ec]' : 'bg-[#f7f7f2]'
}

function ownEntryCellBg(isOwnEntry: boolean) {
  return isOwnEntry ? 'bg-[#eaf5ec]' : 'bg-[#fbfbf5]'
}

function ownEntrySummaryBg(isOwnEntry: boolean) {
  return isOwnEntry
    ? 'bg-[#eaf5ec] hover:bg-[#eaf5ec] group-open:bg-[#eaf5ec]'
    : 'bg-[#f7f7f2] hover:bg-[#fffdf4] group-open:bg-[#fffdf4]'
}

function lastNameFor(name: string) {
  const clean = name.replace(/^OB Stand-in #/, 'OB ')
  if (clean.startsWith('OB ')) return clean
  const parts = clean.split(' ').filter(Boolean)
  return parts.length > 1 ? parts[parts.length - 1] : clean
}

function parsedTeeTimeMs(player?: GolfPlayer | null) {
  if (!player?.teeTime) return null
  const parsed = new Date(player.teeTime).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function pickNameSortValue(name: string) {
  return `${lastNameFor(name)} ${name}`.toLowerCase()
}

function sortPickNamesForPreScoring(names: string[], playerByName: Map<string, GolfPlayer>) {
  const hasTeeTimes = names.some(name => parsedTeeTimeMs(playerByName.get(normalizePickName(name))) !== null)
  return [...names].sort((a, b) => {
    if (hasTeeTimes) {
      const aPlayer = playerByName.get(normalizePickName(a))
      const bPlayer = playerByName.get(normalizePickName(b))
      const aTeeTime = parsedTeeTimeMs(aPlayer) ?? Number.POSITIVE_INFINITY
      const bTeeTime = parsedTeeTimeMs(bPlayer) ?? Number.POSITIVE_INFINITY
      if (aTeeTime !== bTeeTime) return aTeeTime - bTeeTime
      const aStartTee = aPlayer?.startTee ?? 1
      const bStartTee = bPlayer?.startTee ?? 1
      if (aStartTee !== bStartTee) return aStartTee - bStartTee
    }
    return pickNameSortValue(a).localeCompare(pickNameSortValue(b))
  })
}

function outOfBoundsLabel(scoringIsLive: boolean, countScores: number) {
  return scoringIsLive ? `Outside Top ${countScores}` : 'Other picks'
}

function shortName(name: string, peerNames: string[] = []) {
  if (name === 'Picks hidden') return 'Hidden'
  if (name === 'Waiting') return 'Waiting'
  const clean = name.replace(/^OB Stand-in #/, 'OB ')
  if (clean.startsWith('OB ')) return clean
  const parts = clean.split(' ').filter(Boolean)
  if (parts.length <= 1) return clean
  const firstName = parts[0]
  const lastName = parts[parts.length - 1]
  const matchingLastNames = peerNames
    .map(peer => peer.split(' ').filter(Boolean))
    .filter(peerParts => peerParts.length > 1 && lastNameFor(peerParts.join(' ')) === lastName)

  if (matchingLastNames.length <= 1) return lastName

  const firstInitial = firstName[0]
  const initialMatches = matchingLastNames.filter(peerParts => peerParts[0]?.[0] === firstInitial)
  if (initialMatches.length <= 1) return `${firstInitial}. ${lastName}`

  for (let length = 2; length <= firstName.length; length += 1) {
    const prefix = firstName.slice(0, length)
    const prefixMatches = initialMatches.filter(peerParts => peerParts[0]?.startsWith(prefix))
    if (prefixMatches.length === 1) return `${prefix}. ${lastName}`
  }

  return `${firstName}. ${lastName}`
}

function boardTitle(tournament: Tournament | null) {
  return displayTournamentName(tournament?.name) || 'Leaderboard'
}

function formatEventDate(value?: string | null) {
  return formatDateOnly(value, { month: 'short', day: 'numeric', year: 'numeric' })
}

function easternDateKeyFromValue(value?: string | null) {
  if (!value) return null
  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (dateOnlyMatch) return Number(`${dateOnlyMatch[1]}${dateOnlyMatch[2]}${dateOnlyMatch[3]}`)

  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(parsed)
  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value
  const day = parts.find(part => part.type === 'day')?.value
  if (!year || !month || !day) return null
  return Number(`${year}${month}${day}`)
}

function currentEasternDateKey() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value
  const day = parts.find(part => part.type === 'day')?.value
  if (!year || !month || !day) return null
  return Number(`${year}${month}${day}`)
}

function isAfterOpeningRoundDate(tournament: Tournament | null) {
  const startKey = easternDateKeyFromValue(tournament?.start_date)
  const todayKey = currentEasternDateKey()
  if (!startKey || !todayKey) return true
  return todayKey > startKey
}

function poolIsOpenForPicks(pool: PoolRecord, tournament: Tournament | null) {
  return !pool.is_locked && !pool.is_completed && tournament?.status !== 'live' && tournament?.status !== 'completed'
}

function OpenPicksBar({ pool, tournament, mode, entry }: { pool: PoolRecord; tournament: Tournament | null; mode: 'player' | 'runner'; entry?: EntryRecord | null }) {
  if (!poolIsOpenForPicks(pool, tournament)) return null
  const groupedPending = isGroupedFormat(pool) && !pool.groups_finalized_at
  const picked = entryPicks(entry).length
  const needed = totalPicksNeeded(pool)
  const href = mode === 'runner' ? `/pool/${pool.id}?tab=pool-settings` : `/pool/${pool.id}#make-picks`
  const label = mode === 'runner' ? 'Settings' : groupedPending ? 'View groups' : picked > 0 ? 'Edit picks' : 'Make picks'
  const ariaLabel = mode === 'runner' ? `Open settings for ${pool.name}` : `${label} for ${pool.name}`

  return (
    <div className="mb-3 flex items-center justify-between gap-2 border border-[#d8cab0] bg-white px-2 py-2 text-[clamp(0.58rem,2.25vw,0.75rem)] font-black uppercase tracking-[0.08em] text-[#123c2f] sm:px-3">
      {mode === 'runner' ? (
        <span className="min-w-0 whitespace-nowrap text-[#657168]">Event starts: <span className="text-[#123c2f]">{formatEventDate(tournament?.start_date)}</span></span>
      ) : groupedPending ? (
        <span className="min-w-0 whitespace-nowrap text-[#8a6724]">Groups pending</span>
      ) : (
        <span className="min-w-0 whitespace-nowrap text-[#657168]"><span className="text-[#123c2f]">{picked}/{needed}</span> picks</span>
      )}
      <a href={href} className="inline-flex shrink-0 items-center gap-1 border border-[#123c2f] bg-[#fbf7ed] px-2 py-1.5 text-[#123c2f] hover:bg-[#fff4cf] sm:px-3" aria-label={ariaLabel}>
        {mode === 'runner' ? (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" strokeLinejoin="miter">
            <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
            <path d="M19 12a7.1 7.1 0 0 0-.1-1.1l2-1.5-2-3.4-2.4 1a7.8 7.8 0 0 0-1.9-1.1L14.3 3h-4.6l-.3 2.9A7.8 7.8 0 0 0 7.5 7l-2.4-1-2 3.4 2 1.5A7.1 7.1 0 0 0 5 12c0 .4 0 .8.1 1.1l-2 1.5 2 3.4 2.4-1a7.8 7.8 0 0 0 1.9 1.1l.3 2.9h4.6l.3-2.9a7.8 7.8 0 0 0 1.9-1.1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1.1Z" />
          </svg>
        ) : null}
        {label}
      </a>
    </div>
  )
}


function buildScoredEntries(pool: PoolRecord, allEntries: EntryRecord[], selectedLeaderboard?: GolfPlayer[], forceScoring = false): ScoredEntry[] {
  const tournament = Array.isArray(pool.gpp_tournaments) ? pool.gpp_tournaments[0] ?? null : pool.gpp_tournaments ?? null
  const leaderboard = selectedLeaderboard || (Array.isArray(tournament?.leaderboard_json) ? tournament.leaderboard_json : [])
  const canShowRank = forceScoring || Boolean(pool.is_locked || tournamentHasScoringEvidence({ ...tournament, leaderboard_json: leaderboard }))

  if (!forceScoring && !selectedLeaderboard && pool.is_completed && hasCompleteFrozenResults(allEntries)) {
    return frozenResultsForEntries(allEntries)
  }

  if (!canShowRank || leaderboard.length === 0) return []

  return scoreEntriesForLeaderboard(
    allEntries,
    leaderboard,
    {
      countScores: pool.count_scores || pool.pick_count || 0,
      obRuleEnabled: Boolean(pool.ob_rule_enabled),
      obPenaltyStrokes: pool.ob_penalty_strokes ?? 2,
    }
  )
}

function activePoolPickStatusLabel(pick: PickScore, leaderboardByName: Map<string, GolfPlayer>, timeZone: string) {
  return leaderboardBackedPickProgressLabel(pick, leaderboardByName.get(normalizePickName(pick.name)), timeZone)
}

function playerNameKey(player: GolfPlayer) {
  return normalizePickName(player.name || `${player.firstName || ''} ${player.lastName || ''}`.trim())
}

function playerStatusByName(scoringRows: GolfPlayer[], fieldRows: GolfPlayer[]) {
  const byName = new Map<string, GolfPlayer>()
  for (const player of fieldRows) {
    const key = playerNameKey(player)
    if (key) byName.set(key, player)
  }
  for (const player of scoringRows) {
    const key = playerNameKey(player)
    if (!key) continue
    const fieldPlayer = byName.get(key)
    byName.set(key, {
      ...fieldPlayer,
      ...player,
      teeTime: player.teeTime || fieldPlayer?.teeTime,
      startTee: player.startTee ?? fieldPlayer?.startTee,
    })
  }
  return byName
}

function buildPreScoringEntry(entry: EntryRecord, countScores: number, hidePicks: boolean, playerByName: Map<string, GolfPlayer>): ScoredEntry {
  if (hidePicks) {
    return {
      entryId: entry.id,
      displayName: entry.display_name || 'Entry',
      picks: ['__hidden__'],
      pickScores: Array.from({ length: countScores }, () => ({
        name: 'Picks hidden',
        scoreToPar: null,
        strokes: null,
        thru: '',
        status: 'active' as const,
        counted: true,
        isObStandIn: false,
      })),
      totalScore: null,
      todayScore: null,
      finalNineScore: null,
      tiebreakScores: [],
      rank: null,
      obStandIns: 0,
    }
  }

  const orderedPicks = sortPickNamesForPreScoring(
    Array.isArray(entry.golfer_picks) ? entry.golfer_picks as string[] : [],
    playerByName
  )
  const pickScores = orderedPicks.map((name, index) => ({
    name,
    scoreToPar: null,
    strokes: null,
    thru: '',
    status: 'active' as const,
    counted: index < countScores,
    isObStandIn: false,
  }))

  return {
    entryId: entry.id,
    displayName: entry.display_name || 'Entry',
    picks: orderedPicks,
    pickScores,
    totalScore: null,
    todayScore: null,
    finalNineScore: null,
    tiebreakScores: [],
    rank: null,
    obStandIns: 0,
  }
}

function CurrentUserMarker({ className = '' }: { className?: string }) {
  return <span aria-label="Your entry" title="Your entry" className={`inline-block h-2.5 w-2.5 shrink-0 bg-[#1f6b4a] ${className}`} />
}

function isGroupedFormat(pool: PoolRecord) {
  return pool.game_format === 'grouped' || pool.game_format === 'random_groups' || pool.game_format === 'ranked_groups'
}

function formatMyEntryLockTime(value?: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return null
  const weekday = parsed.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long' })
  const time = parsed.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
  }).toLowerCase().replace(' ', '')
  return `Locks ${weekday} ${time}`
}

function MyEntryPreTournamentBadges({ pool, entry }: { pool: PoolRecord; entry?: EntryRecord | null }) {
  if (isGroupedFormat(pool) && !pool.groups_finalized_at) {
    return <span className="border border-[#b58a3a] bg-[#fff4cf] px-2 py-1 text-[#7a5a19]">Groups pending</span>
  }

  const needed = totalPicksNeeded(pool)
  const picked = entryPicks(entry).length
  const remaining = Math.max(0, needed - picked)
  const lockLabel = formatMyEntryLockTime(pool.lock_at)

  return (
    <>
      <span className="border border-[#d8cab0] bg-[#fbf7ed] px-1.5 py-1 text-[#123c2f] sm:px-2">{picked}/{needed} picks</span>
      {remaining > 0 ? <span className="border border-[#b58a3a] bg-[#fff4cf] px-1.5 py-1 text-[#7a5a19] sm:px-2">Needs {remaining}</span> : null}
      {remaining === 0 && lockLabel ? <span className="hidden border border-[#d8cab0] bg-[#fbf7ed] px-1.5 py-1 text-[#657168] sm:inline-flex sm:px-2">{lockLabel}</span> : null}
    </>
  )
}

function InlineLeaderboard({ pool, entries, currentEntryId, openEntryIds, onEntryToggle, teeTimeZone, mode, viewStateKey, nowMs }: {
  pool: PoolRecord
  entries: EntryRecord[]
  currentEntryId?: string | null
  openEntryIds: Set<string> | null
  onEntryToggle: (entryId: string, open: boolean) => void
  teeTimeZone: string
  mode: 'player' | 'runner'
  viewStateKey: string
  nowMs: number | null
}) {
  const countScores = pool.count_scores || pool.pick_count || 0
  const tournament = Array.isArray(pool.gpp_tournaments) ? pool.gpp_tournaments[0] ?? null : pool.gpp_tournaments ?? null
  const groupedFormat = isGroupedPoolFormat(pool.game_format)
  const pickGroups: PickGroup[] = groupedFormat && Array.isArray(pool.pick_groups_json) ? pool.pick_groups_json as PickGroup[] : []
  const baseLeaderboardRows = Array.isArray(tournament?.leaderboard_json) ? tournament.leaderboard_json : []
  const fieldRows = Array.isArray(tournament?.field_json) ? tournament.field_json : []
  const [leaderboardMode, setLeaderboardMode] = useState<LeaderboardMode>(() => storedLeaderboardMode(viewStateKey, pool.id) ?? { type: 'current' })
  const [leaderboardMenuOpen, setLeaderboardMenuOpen] = useState(false)
  const availableHistoricalRounds = useMemo(() => availableCompletedRounds(baseLeaderboardRows), [baseLeaderboardRows])
  const hasPlayoffScores = useMemo(() => leaderboardHasPlayoffScores(baseLeaderboardRows), [baseLeaderboardRows])
  useEffect(() => {
    if (leaderboardMode.type === 'current') return
    if (!availableHistoricalRounds.includes(leaderboardMode.round)) {
      setLeaderboardMode({ type: 'current' })
      return
    }
    if (leaderboardMode.type === 'day' && leaderboardMode.round === 1) setLeaderboardMode({ type: 'thru', round: 1 })
  }, [availableHistoricalRounds, leaderboardMode])
  useEffect(() => {
    writeDashboardLeaderboardMode(viewStateKey, pool.id, leaderboardMode)
  }, [pool.id, leaderboardMode, viewStateKey])
  const leaderboardRows = useMemo(() => {
    if (leaderboardMode.type === 'thru') return leaderboardForCompletedRound(baseLeaderboardRows, leaderboardMode.round)
    if (leaderboardMode.type === 'day') return leaderboardForRoundOnly(baseLeaderboardRows, leaderboardMode.round)
    return baseLeaderboardRows
  }, [baseLeaderboardRows, leaderboardMode])
  const leaderboardModeIsCurrent = leaderboardMode.type === 'current'
  const boardLabel = selectedBoardLabel(leaderboardMode, hasPlayoffScores)
  const selectedBoardIsHistorical = !leaderboardModeIsCurrent
  const currentRound = leaderboardModeIsCurrent ? currentLeaderboardRound(baseLeaderboardRows) : null
  const totalScoreSubLabel = leaderboardMode.type === 'current'
    ? (currentRound ? roundScoreLabel(currentRound) : availableHistoricalRounds.length > 0 || isAfterOpeningRoundDate(tournament) ? 'TODAY' : null)
    : leaderboardMode.type === 'thru' && leaderboardMode.round > 1
      ? roundScoreLabel(leaderboardMode.round)
      : null
  const scoringIsLive = leaderboardRows.length > 0 && Boolean(pool.is_locked || tournamentHasScoringEvidence({ ...tournament, leaderboard_json: leaderboardRows }))
  const leaderboardByName = playerStatusByName(leaderboardRows, fieldRows)
  const preScoringPlayerByName = playerStatusByName(baseLeaderboardRows, fieldRows)
  const scoredEntries = scoringIsLive
    ? buildScoredEntries(pool, entries, leaderboardRows, selectedBoardIsHistorical)
    : entries.map(entry => buildPreScoringEntry(entry, countScores, entry.id !== currentEntryId && Boolean(entry.picks_hidden), preScoringPlayerByName))
  const golferNamePeers = (leaderboardRows.length ? leaderboardRows : fieldRows)
    .map(player => player.name || `${player.firstName || ''} ${player.lastName || ''}`.trim())
    .filter(Boolean)

  function entryHasSubmittedPicks(entryId: string) {
    const sourceEntry = entries.find(record => record.id === entryId)
    if (!sourceEntry || sourceEntry.picks_hidden) return false
    return Array.isArray(sourceEntry.golfer_picks) && sourceEntry.golfer_picks.length > 0
  }

  function orderPicksForDisplay(picks: PickScore[]) {
    if (!scoringIsLive || !groupedFormat || pickGroups.length === 0) return picks
    const order = new Map<string, number>()
    pickGroups.forEach((group, groupIndex) => {
      group.players.forEach((player, playerIndex) => order.set(normalizePickName(player.name), groupIndex * 1000 + playerIndex))
    })
    return [...picks].sort((a, b) => {
      const aOrder = order.get(normalizePickName(a.name)) ?? 999999
      const bOrder = order.get(normalizePickName(b.name)) ?? 999999
      return aOrder - bOrder || a.name.localeCompare(b.name)
    })
  }

  function pickGroupShortLabel(name?: string) {
    if (!name || !groupedFormat) return null
    const group = groupForPick(pickGroups, name)
    return group ? group.label.replace('Group ', 'G') : null
  }

  const currentScoredEntry = currentEntryId ? scoredEntries.find(entry => entry.entryId === currentEntryId) : null
  const currentEntryRecord = currentEntryId ? entries.find(entry => entry.id === currentEntryId) : null
  const priorMovementRound = leaderboardModeIsCurrent ? priorCompletedRoundForMovement(baseLeaderboardRows) : null
  const priorMovementEntries = priorMovementRound
    ? buildScoredEntries(pool, entries, leaderboardForCompletedRound(baseLeaderboardRows, priorMovementRound), true)
    : []
  const currentMovementToday = currentScoredEntry && leaderboardModeIsCurrent && priorMovementEntries.length > 0
    ? entryMovementSincePriorRank(currentScoredEntry, priorMovementEntries)
    : null
  const scoreFreshness = formatScoreFreshness(tournament?.last_scores_fetch, nowMs)
  const boardSectionRef = useRef<HTMLDivElement>(null)
  const fixedMyEntryBarRef = useRef<HTMLDivElement>(null)
  const [fixedMyEntryBarState, setFixedMyEntryBarState] = useState<'before' | 'shown' | 'after'>('before')
  const harePickMap = leaderboardModeIsCurrent ? buildHarePickMap(scoredEntries, 2) : new Map()
  const tortoisePickMap = leaderboardModeIsCurrent ? buildTortoisePickMap(scoredEntries, currentEntryId, 2) : new Map()
  const showLeverageLegend = leaderboardModeIsCurrent && (harePickMap.size > 0 || tortoisePickMap.size > 0)
  const showMyEntryBar = mode === 'player' && scoringIsLive && Boolean(currentScoredEntry)
  const showJumpToMyEntry = mode === 'player' && scoringIsLive && Boolean(currentScoredEntry && scoredEntries.length >= 10)

  useEffect(() => {
    if (!showMyEntryBar || leaderboardMenuOpen) {
      setFixedMyEntryBarState('before')
      return
    }

    const updateFixedBar = () => {
      if (window.matchMedia('(min-width: 640px)').matches || leaderboardMenuOpen) {
        setFixedMyEntryBarState('before')
        return
      }
      const rect = boardSectionRef.current?.getBoundingClientRect()
      if (!rect) return
      const topOffset = 8
      const barHeight = fixedMyEntryBarRef.current?.offsetHeight || 40
      if (rect.top >= topOffset) setFixedMyEntryBarState('before')
      else if (rect.bottom <= topOffset + barHeight) setFixedMyEntryBarState('after')
      else setFixedMyEntryBarState('shown')
    }

    updateFixedBar()
    window.addEventListener('scroll', updateFixedBar, { passive: true })
    window.addEventListener('resize', updateFixedBar)
    return () => {
      window.removeEventListener('scroll', updateFixedBar)
      window.removeEventListener('resize', updateFixedBar)
    }
  }, [leaderboardMenuOpen, showMyEntryBar])

  const fixedMyEntryBarClass = fixedMyEntryBarState === 'shown'
    ? 'translate-y-0 opacity-100'
    : fixedMyEntryBarState === 'after'
      ? 'translate-y-0 opacity-0 pointer-events-none'
      : '-translate-y-[calc(100%+1rem)] opacity-0 pointer-events-none'
  const inlineMyEntryBarClass = fixedMyEntryBarState === 'shown' ? 'opacity-0 pointer-events-none sm:opacity-100 sm:pointer-events-auto' : 'opacity-100'

  const jumpToCurrentEntry = () => {
    if (!currentEntryId) return
    onEntryToggle(currentEntryId, true)
    window.setTimeout(() => {
      const targets = Array.from(document.querySelectorAll<HTMLElement>(`[data-dashboard-entry-id="${currentEntryId}"]`))
      const visibleTarget = targets.find(target => target.offsetParent !== null) || targets[0]
      visibleTarget?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 0)
  }

  if (scoredEntries.length === 0) {
    return (
      <div className="border-t border-[#eadfca] bg-[#fbf7ed] px-4 py-4 sm:px-5">
        <OpenPicksBar pool={pool} tournament={tournament} mode={mode} entry={currentEntryRecord} />
      </div>
    )
  }

  return (
    <div ref={boardSectionRef} className="overflow-visible border-t border-[#eadfca] bg-[#fbf7ed] px-2 pb-0 pt-2 sm:px-5 sm:pt-4">
      {showMyEntryBar && currentScoredEntry ? (
        <div
          ref={fixedMyEntryBarRef}
          aria-hidden="true"
          className={`pointer-events-none fixed left-6 right-6 top-[calc(env(safe-area-inset-top)+0.5rem)] z-[240] flex items-center justify-between gap-1.5 border-2 border-[#123c2f] bg-white px-2 py-2 text-[clamp(0.58rem,2.2vw,0.75rem)] font-black uppercase tracking-[0.08em] shadow-[2px_2px_0_#d8cab0] transition-[transform,opacity] duration-200 ease-out sm:hidden ${fixedMyEntryBarClass}`}
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="inline-flex shrink-0 items-center gap-1 text-[#123c2f]"><CurrentUserMarker /> My entry</span>
            <span className="border border-[#b58a3a] bg-[#fff4cf] px-2 py-1 text-[#7a5a19]">#{currentScoredEntry.rank || '—'}</span>
            <span className={`border px-2 py-1 ${scoreBadgeClass(currentScoredEntry.totalScore)}`}>{formatScore(currentScoredEntry.totalScore)}</span>
            <TodayMovementBadge label={totalScoreSubLabel} score={currentScoredEntry.todayScore} movement={currentMovementToday} />
          </div>
        </div>
      ) : null}
      <OpenPicksBar pool={pool} tournament={tournament} mode={mode} entry={currentEntryRecord} />
      {showMyEntryBar && currentScoredEntry ? (
        <div className={`mb-3 flex items-center justify-between gap-1.5 border-2 border-[#123c2f] bg-white px-2 py-2 text-[clamp(0.58rem,2.2vw,0.75rem)] shadow-[3px_3px_0_#d8cab0] transition-opacity duration-150 sm:px-3 ${inlineMyEntryBarClass}`}>
          <div className="flex min-w-0 items-center gap-1.5 font-black uppercase tracking-[0.08em]">
            <span className="inline-flex shrink-0 items-center gap-1 text-[#123c2f]"><CurrentUserMarker /> My entry</span>
            {scoringIsLive ? (
              <>
                <span className="border border-[#b58a3a] bg-[#fff4cf] px-2 py-1 text-[#7a5a19]">#{currentScoredEntry.rank || '—'}</span>
                <span className={`border px-2 py-1 ${scoreBadgeClass(currentScoredEntry.totalScore)}`}>{formatScore(currentScoredEntry.totalScore)}</span>
                <TodayMovementBadge label={totalScoreSubLabel} score={currentScoredEntry.todayScore} movement={currentMovementToday} />
              </>
            ) : (
              <MyEntryPreTournamentBadges pool={pool} entry={currentEntryRecord} />
            )}
          </div>
        </div>
      ) : null}
      <div
        className="gpp-3d relative z-20 [--gpp-depth-x:12px] [--gpp-depth-y:8px] [--gpp-side-color:#001f17] [--gpp-bottom-color:#001f17] md:[--gpp-depth-x:22px] md:[--gpp-depth-y:14px]"
        style={{ fontFamily: 'Arial Narrow, Arial, sans-serif' }}
      >
        <div className="gpp-board-depth-right" aria-hidden="true" />
        <div className="gpp-board-depth-bottom" aria-hidden="true" />
        <div className="gpp-3d-face gpp-board-frame border-[10px] border-[#123c2f] md:border-[16px]">
          <div className="gpp-score-face border-2 border-[#d8b45d] bg-[#f7f7f2] text-center">
            <div className="relative border-b-2 border-[#d8cab0] px-3 py-2">
              <span className="absolute right-2 top-2 border border-[#d8cab0] bg-white px-1.5 py-0.5 text-[8px] font-black uppercase leading-none tracking-[0.08em] text-[#657168] sm:right-3 sm:top-3 sm:px-2 sm:py-1 sm:text-[10px]">
                {formatEntryCount(entries.length)}
              </span>
              <p className="mx-auto mt-5 max-w-[98%] truncate text-[19px] font-black uppercase leading-none tracking-[0.06em] text-[#111] sm:mt-0 sm:max-w-[76%] sm:text-3xl sm:tracking-[0.16em]" title={boardTitle(tournament)}>{boardTitle(tournament)}</p>
              <p className="mx-auto mt-1 max-w-[98%] truncate text-[10px] font-black uppercase tracking-[0.04em] text-[#005b3c] sm:text-xs sm:tracking-[0.08em]" title={pool.name}>{pool.name}</p>
              <div className="mt-2 flex w-full flex-wrap items-center justify-center gap-2">
                {showJumpToMyEntry ? (
                  <button type="button" onClick={jumpToCurrentEntry} className="inline-flex h-9 items-center justify-center border-2 border-[#123c2f] bg-[#123c2f] px-3 text-[9px] font-black uppercase leading-none tracking-[0.08em] text-white shadow-[2px_2px_0_#b58a3a] hover:bg-[#0f2f25] sm:px-3.5 sm:text-[10px]">
                    Jump to my entry
                  </button>
                ) : null}
                {availableHistoricalRounds.length > 0 && (
                  <details
                    className="relative z-50 shrink-0 text-left"
                    open={leaderboardMenuOpen}
                    onToggle={event => setLeaderboardMenuOpen(event.currentTarget.open)}
                  >
                    <summary className="inline-flex h-9 cursor-pointer list-none items-center justify-center border-2 border-[#123c2f] bg-white px-3 text-[10px] font-black uppercase leading-none tracking-[0.1em] text-[#123c2f] shadow-[2px_2px_0_#d8cab0] marker:hidden [&::-webkit-details-marker]:hidden">
                      <span className="mr-2 text-[#657168]">View</span>{boardLabel}
                      <span className="ml-2 inline-block text-[#123c2f]">▾</span>
                    </summary>
                    <div className="absolute left-1/2 top-[calc(100%+6px)] z-[220] w-44 -translate-x-1/2 border-2 border-[#123c2f] bg-[#fffdf8] p-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#123c2f] shadow-[5px_5px_0_#d8cab0]">
                      <button
                        type="button"
                        onClick={() => { setLeaderboardMode({ type: 'current' }); setLeaderboardMenuOpen(false) }}
                        className={`block w-full px-3 py-2 text-left ${leaderboardMode.type === 'current' ? 'bg-[#fbf7ed] shadow-[inset_4px_0_0_#b58a3a]' : 'border-b border-[#d8cab0]'}`}
                      >
                        Current
                      </button>
                      {availableHistoricalRounds.map(round => (
                        <div key={round} className="border-b border-[#d8cab0] py-1 last:border-b-0">
                          <div className="px-3 pb-1 pt-2 text-[9px] text-[#657168]">{isFinalRound(round, hasPlayoffScores) ? 'Final' : roundMenuLabel(round)}</div>
                          <button
                            type="button"
                            onClick={() => { setLeaderboardMode({ type: 'thru', round }); setLeaderboardMenuOpen(false) }}
                            className={`block w-full px-3 py-2 text-left ${leaderboardMode.type === 'thru' && leaderboardMode.round === round ? 'bg-[#fbf7ed] shadow-[inset_4px_0_0_#b58a3a]' : ''}`}
                          >
                            {cumulativeRoundLabel(round, hasPlayoffScores)}
                          </button>
                          {round > 1 ? (
                            <button
                              type="button"
                              onClick={() => { setLeaderboardMode({ type: 'day', round }); setLeaderboardMenuOpen(false) }}
                              className={`block w-full px-3 py-2 text-left ${leaderboardMode.type === 'day' && leaderboardMode.round === round ? 'bg-[#fbf7ed] shadow-[inset_4px_0_0_#b58a3a]' : ''}`}
                            >
                              {roundMenuLabel(round)} Only
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                {scoreFreshness ? <span className="hidden text-[9px] font-black uppercase leading-none tracking-[0.08em] text-[#657168] sm:inline">{scoreFreshness}</span> : null}
              </div>
              {selectedBoardIsHistorical ? <p className="mt-1 text-[9px] font-black uppercase tracking-[0.1em] text-[#657168]">{historicalBoardCaption(leaderboardMode, hasPlayoffScores)}</p> : null}
            </div>
            <div className="bg-[#f7f7f2] lg:hidden">
              {scoredEntries.map((entry, entryIndex) => {
                const countingPicks = orderPicksForDisplay(entry.pickScores.filter(pick => pick.counted)).slice(0, countScores)
                const outOfBoundsPicks = orderPicksForDisplay(entry.pickScores.filter(pick => !pick.counted))
                const allPickNames = golferNamePeers
                const isCurrentEntry = entry.entryId === currentEntryId
                const hareNames = isCurrentEntry ? harePickMap.get(entry.entryId) : undefined
                const tortoiseNames = !isCurrentEntry ? tortoisePickMap.get(entry.entryId) : undefined
                const isOpen = openEntryIds ? openEntryIds.has(entry.entryId) : (entry.entryId === currentEntryId || (!currentEntryId && entryIndex === 0))
                const picksHidden = entry.picks.includes('__hidden__')
                const hasSubmittedPicks = entryHasSubmittedPicks(entry.entryId)
                const showPreScoringWaiting = !scoringIsLive && !hasSubmittedPicks
                const pickGridColumns = pickGridColumnCount(countScores)
                return (
                  <details data-dashboard-entry-id={isCurrentEntry ? entry.entryId : undefined} data-dashboard-scroll-anchor={`entry:${entry.entryId}`} id={isCurrentEntry ? `dashboard-entry-${entry.entryId}` : undefined} key={entry.entryId} open={isOpen} onToggle={event => onEntryToggle(entry.entryId, event.currentTarget.open)} className="scroll-mt-28 group border-b-2 border-[#d8cab0] last:border-b-0">
                    <summary className={`grid min-h-[58px] cursor-pointer list-none grid-cols-[34px_minmax(0,1fr)_58px_18px] items-center gap-1 px-2 py-2 text-left transition-colors sm:grid-cols-[44px_minmax(0,1fr)_74px_20px] sm:gap-2 [&::-webkit-details-marker]:hidden ${ownEntrySummaryBg(isCurrentEntry)}`}>
                      <div className="text-center text-xl font-black text-[#b21e23]">{entry.rank || '—'}</div>
                      <div className="min-w-0">
                        <span className="flex min-w-0 items-center gap-1.5">
                          {isCurrentEntry ? <CurrentUserMarker /> : null}
                          <span className="min-w-0 flex-1 truncate text-sm font-black uppercase leading-tight tracking-[0.02em] text-[#111] sm:text-base sm:tracking-[0.04em]">{entry.displayName}</span>
                        </span>
                        {(picksHidden || showPreScoringWaiting || entry.obStandIns > 0) && (
                          <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#555]">
                            {picksHidden ? 'Picks hidden until lock' : scoringIsLive ? <span className="text-[#b21e23]">{entry.obStandIns} OB</span> : 'Waiting'}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-black leading-none ${scoreClass(entry.totalScore)}`}>{formatScore(entry.totalScore)}</div>
                        {totalScoreSubLabel && entry.todayScore !== null ? <div className="mt-0.5 whitespace-nowrap text-[8px] font-black uppercase tracking-normal text-[#777] sm:text-[9px] sm:tracking-[0.08em]">{totalScoreSubLabel} {formatScore(entry.todayScore)}</div> : null}
                      </div>
                      <div className="flex items-center justify-center text-[#111]" aria-label={isOpen ? 'Collapse entry' : 'Expand entry'}>
                        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d={isOpen ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'} stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" /></svg>
                      </div>
                    </summary>
                    <div className="grid border-t border-[#d8cab0] bg-[#fbfbf5]" style={{ gridTemplateColumns: `repeat(${pickGridColumns}, minmax(0, 1fr))` }}>
                      {Array.from({ length: countScores }, (_, i) => {
                        const pick = countingPicks[i]
                        const isEndOfGridRow = (i + 1) % pickGridColumns === 0
                        return (
                          <div key={i} className="relative border-r border-t border-[#d8cab0] px-1 py-1.5 text-center" style={{ borderRightWidth: isEndOfGridRow ? 0 : undefined }}>
                            <>{pick?.isObStandIn ? <ObMarkerCorner /> : <LeverageMarkerCorner kind={pick && hareNames?.has(normalizePickName(pick.name)) ? 'hare' : pick && tortoiseNames?.has(normalizePickName(pick.name)) ? 'tortoise' : undefined} />}</>
                            {pick && pickGroupShortLabel(pick.name) ? (
                              <span className="absolute left-0.5 top-0.5 z-[2] inline-flex items-center border border-[#123c2f] bg-[#123c2f] px-[3px] py-[1px] text-[8px] font-black leading-none text-white">
                                {pickGroupShortLabel(pick.name)}
                              </span>
                            ) : null}
                            <div className={`text-lg font-black leading-none ${scoreClass(pick?.scoreToPar ?? null)}`}>{formatPickScore(pick)}</div>
                            <div className="mt-1 truncate text-[clamp(8px,2.2vw,10px)] font-black uppercase leading-none tracking-[-0.03em] text-[#111] sm:text-xs sm:tracking-[-0.01em]">
                              {pick ? shortName(pick.name, allPickNames) : 'Waiting'}
                            </div>
                            <div className="mt-0.5 text-[8px] font-black uppercase tracking-[0.06em] text-[#555]">{pick ? (pick.name === 'Waiting' ? 'Waiting' : [pickGroupShortLabel(pick.name), activePoolPickStatusLabel(pick, leaderboardByName, teeTimeZone)].filter(Boolean).join(' · ')) : 'Waiting'}</div>
                          </div>
                        )
                      })}
                    </div>
                    {outOfBoundsPicks.length > 0 && (
                      <div className="border-t-2 border-[#d8cab0] bg-[#efeee6] px-2 py-1.5 text-left">
                        <div className="mb-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#111]">{outOfBoundsLabel(scoringIsLive, countScores)}</div>
                        <div className="flex flex-wrap gap-1">
                          {outOfBoundsPicks.map(pick => (
                            <span key={`${entry.entryId}-${pick.name}`} className="relative inline-flex items-center gap-1 border border-[#d8cab0] bg-[#fbfbf5] px-1.5 py-1 text-[10px] font-black uppercase leading-none text-[#111]">
                              {pick.isObStandIn ? <ObMarker /> : null}
                              {hareNames?.has(normalizePickName(pick.name)) ? <LeverageMarker kind="hare" /> : null}
                              {tortoiseNames?.has(normalizePickName(pick.name)) ? <LeverageMarker kind="tortoise" /> : null}
                              {pickGroupShortLabel(pick.name) ? (
                                <span className="inline-flex shrink-0 items-center border border-[#123c2f] bg-[#123c2f] px-[3px] py-[1px] text-[7px] font-black leading-none text-white">
                                  {pickGroupShortLabel(pick.name)}
                                </span>
                              ) : null}
                              <span><span className={scoreClass(pick.scoreToPar)}>{formatPickScore(pick)}</span> {shortName(pick.name, allPickNames)} <span className="text-[#555]">{activePoolPickStatusLabel(pick, leaderboardByName, teeTimeZone)}</span></span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </details>
                )
              })}
            </div>
            <div className="hidden bg-[#f7f7f2] lg:block">
              <table className="w-full table-fixed border-collapse text-[12px] text-[#111]">
                <thead>
                  <tr className="bg-[#f7f7f2] text-[10px] font-black uppercase tracking-[0.12em] text-[#111]">
                    <th className="w-[5%] border-b-2 border-r-2 border-[#d8cab0] bg-[#f7f7f2] px-1 py-1.5 text-center">Rank</th>
                    <th className="w-[19%] border-b-2 border-r-2 border-[#d8cab0] bg-[#f7f7f2] px-2 py-1.5 text-left">Entry</th>
                    <th className="border-b-2 border-r-2 border-[#d8cab0] px-1 py-1.5 text-center" colSpan={countScores}>Top {countScores} golfers</th>
                    <th className="w-[9%] border-b-2 border-[#d8cab0] px-1 py-1.5 text-center">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {scoredEntries.map(entry => {
                    const countingPicks = orderPicksForDisplay(entry.pickScores.filter(pick => pick.counted)).slice(0, countScores)
                    const outOfBoundsPicks = orderPicksForDisplay(entry.pickScores.filter(pick => !pick.counted))
                    const allPickNames = golferNamePeers
                    const isCurrentEntry = entry.entryId === currentEntryId
                    const hareNames = isCurrentEntry ? harePickMap.get(entry.entryId) : undefined
                    const tortoiseNames = !isCurrentEntry ? tortoisePickMap.get(entry.entryId) : undefined
                    const picksHidden = entry.picks.includes('__hidden__')
                    const hasSubmittedPicks = entryHasSubmittedPicks(entry.entryId)
                    const showPreScoringWaiting = !scoringIsLive && !hasSubmittedPicks
                    return (
                      <Fragment key={entry.entryId}>
                        <tr data-dashboard-entry-id={isCurrentEntry ? entry.entryId : undefined} data-dashboard-scroll-anchor={`entry:${entry.entryId}`} className={`scroll-mt-28 transition-colors ${ownEntryRowBg(isCurrentEntry)}`}>
                          <td className={`border-b border-r-2 border-[#d8cab0] px-1 py-1.5 text-center text-xl font-black text-[#b21e23] ${ownEntryRowBg(isCurrentEntry)}`}>{entry.rank || '—'}</td>
                          <td className={`border-b border-r-2 border-[#d8cab0] px-2 py-1.5 text-left ${ownEntryRowBg(isCurrentEntry)}`}>
                            <span className="flex min-w-0 items-center gap-1.5" title={entry.displayName}>
                              {isCurrentEntry ? <CurrentUserMarker /> : null}
                              <span className="truncate text-base font-black uppercase tracking-[0.02em] text-[#111]">{entry.displayName}</span>
                            </span>
                            {(picksHidden || showPreScoringWaiting || entry.obStandIns > 0) && (
                              <div className="mt-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-[#555]">
                                {picksHidden ? 'Picks hidden until lock' : scoringIsLive ? <span className="text-[#b21e23]">{entry.obStandIns} OB</span> : 'Waiting'}
                              </div>
                            )}
                          </td>
                          {Array.from({ length: countScores }, (_, i) => {
                            const pick = countingPicks[i]
                            return (
                              <td key={i} title={pick?.name || ''} className={`relative border-b border-r border-[#d8cab0] px-1 py-1 text-center align-middle shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] ${ownEntryCellBg(isCurrentEntry)}`}>
                                <>{pick?.isObStandIn ? <ObMarkerCorner /> : <LeverageMarkerCorner kind={pick && hareNames?.has(normalizePickName(pick.name)) ? 'hare' : pick && tortoiseNames?.has(normalizePickName(pick.name)) ? 'tortoise' : undefined} />}</>
                                {pick && pickGroupShortLabel(pick.name) ? (
                                  <span className="absolute left-0.5 top-0.5 z-[2] inline-flex items-center border border-[#123c2f] bg-[#123c2f] px-[3px] py-[1px] text-[8px] font-black leading-none text-white">
                                    {pickGroupShortLabel(pick.name)}
                                  </span>
                                ) : null}
                                <div className={`text-lg font-black leading-none ${scoreClass(pick?.scoreToPar ?? null)}`}>{formatPickScore(pick)}</div>
                                <div className="mt-0.5 truncate text-[11px] font-black uppercase leading-tight tracking-[-0.01em] text-[#111] xl:text-xs">{pick ? shortName(pick.name, allPickNames) : 'Waiting'}</div>
                                <div className="mt-0.5 text-[8px] font-black uppercase tracking-[0.06em] text-[#555]">{pick ? (pick.name === 'Waiting' ? 'Waiting' : [pickGroupShortLabel(pick.name), activePoolPickStatusLabel(pick, leaderboardByName, teeTimeZone)].filter(Boolean).join(' · ')) : 'Waiting'}</div>
                              </td>
                            )
                          })}
                          <td className={`border-b border-[#d8cab0] px-1 py-1.5 text-center align-middle ${ownEntryCellBg(isCurrentEntry)} ${scoreClass(entry.totalScore)}`}>
                            <div className="text-3xl font-black leading-none">{formatScore(entry.totalScore)}</div>
                            {totalScoreSubLabel && entry.todayScore !== null ? <div className="mt-0.5 whitespace-nowrap text-[8px] font-black uppercase tracking-normal text-[#777] sm:text-[9px] sm:tracking-[0.08em]">{totalScoreSubLabel} {formatScore(entry.todayScore)}</div> : null}
                          </td>
                        </tr>
                        {outOfBoundsPicks.length > 0 && (
                          <tr className="bg-[#efeee6]">
                            <td className="border-b border-r-2 border-[#d8cab0] bg-[#efeee6]" />
                            <td className="border-b border-r-2 border-[#d8cab0] bg-[#efeee6] px-2 py-1 text-left text-[9px] font-black uppercase tracking-[0.1em] text-[#111]">{outOfBoundsLabel(scoringIsLive, countScores)}</td>
                            <td className="border-b border-[#d8cab0] bg-[#efeee6] px-2 py-1 text-left" colSpan={countScores + 1}>
                              <div className="flex flex-wrap gap-1">
                                {outOfBoundsPicks.map(pick => (
                                  <span key={`${entry.entryId}-${pick.name}`} className="relative inline-flex items-center gap-1 border border-[#d8cab0] bg-[#fbfbf5] px-1.5 py-1 text-[10px] font-black uppercase leading-none text-[#111]">
                                    {pick.isObStandIn ? <ObMarker /> : null}
                                    {hareNames?.has(normalizePickName(pick.name)) ? <LeverageMarker kind="hare" /> : null}
                                    {tortoiseNames?.has(normalizePickName(pick.name)) ? <LeverageMarker kind="tortoise" /> : null}
                                    {pickGroupShortLabel(pick.name) ? (
                                      <span className="inline-flex shrink-0 items-center border border-[#123c2f] bg-[#123c2f] px-[3px] py-[1px] text-[7px] font-black leading-none text-white">
                                        {pickGroupShortLabel(pick.name)}
                                      </span>
                                    ) : null}
                                    <span><span className={scoreClass(pick.scoreToPar)}>{formatPickScore(pick)}</span> {shortName(pick.name, allPickNames)} <span className="text-[#555]">{activePoolPickStatusLabel(pick, leaderboardByName, teeTimeZone)}</span></span>
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {showLeverageLegend ? <LeverageMarkerLegend showTortoise={tortoisePickMap.size > 0} centerInfoBox className="mt-1" /> : null}
        </div>
      </div>
      <div className="gpp-board-post relative z-0 mx-auto -mt-[4px] h-36 w-20 [--gpp-depth-x:12px] [--gpp-depth-y:8px] md:-mt-[7px] md:h-44 md:w-24 md:[--gpp-depth-x:22px] md:[--gpp-depth-y:14px]">
        <div className="gpp-board-post-depth" aria-hidden="true" />
        <div className="gpp-board-post-face" aria-hidden="true" />
      </div>
    </div>
  )
}

function buildRankPreview(entry: EntryRecord, pool: PoolRecord, allEntries: EntryRecord[]): RankPreview | null {
  const scored = buildScoredEntries(pool, allEntries)
  const current = scored.find(scoredEntry => scoredEntry.entryId === entry.id)
  if (!current) return null
  const tournament = Array.isArray(pool.gpp_tournaments) ? pool.gpp_tournaments[0] ?? null : pool.gpp_tournaments ?? null
  const leaderboard = Array.isArray(tournament?.leaderboard_json) ? tournament.leaderboard_json : []
  const priorRound = priorCompletedRoundForMovement(leaderboard)
  const priorEntries = priorRound ? buildScoredEntries(pool, allEntries, leaderboardForCompletedRound(leaderboard, priorRound), true) : []
  const showToday = Boolean(priorRound || isAfterOpeningRoundDate(tournament))
  return {
    rank: current.rank,
    totalScore: current.totalScore,
    todayScore: showToday ? current.todayScore : null,
    movementToday: showToday && priorEntries.length > 0 ? entryMovementSincePriorRank(current, priorEntries) : null,
  }
}

function buildLeaderPreview(pool: PoolRecord, allEntries: EntryRecord[]): RankPreview | null {
  const leader = buildScoredEntries(pool, allEntries).find(entry => entry.rank === 1 && entry.totalScore !== null)
  if (!leader) return null
  return {
    rank: leader.rank,
    totalScore: leader.totalScore,
    todayScore: leader.todayScore,
    movementToday: null,
  }
}

function entryPicks(entry?: EntryRecord | null) {
  if (entry?.picks_hidden) return []
  return Array.isArray(entry?.golfer_picks) ? entry.golfer_picks as string[] : []
}

function totalPicksNeeded(pool: PoolRecord): number {
  return totalPicksRequired(pool)
}

function canShowPickBadge(pool: PoolRecord, tournament: Tournament | null) {
  // Once tournament starts, hide pick badge entirely
  if (tournament?.status === 'live' || tournament?.status === 'completed') return false
  if (pool.is_locked || pool.is_completed) return false
  // For grouped pools, only show after groups are locked
  if (isGroupedPoolFormat(pool.game_format)) return Boolean(pool.groups_finalized_at)
  // Open Field pool: show as soon as field is imported (picks can be made)
  return true
}

function PickProgressBadge({ entry, pool, tournament }: { entry?: EntryRecord | null; pool: PoolRecord; tournament?: Tournament | null }) {
  const picks = entryPicks(entry)
  const needed = totalPicksNeeded(pool)
  const count = picks.length
  const done = count >= needed
  if (!canShowPickBadge(pool, tournament ?? null)) return null
  if (done) {
    return (
      <span className="inline-flex min-h-6 items-center gap-1 whitespace-nowrap border border-[#1f6b4a] bg-[#eef7ef] px-2 py-1 text-[10px] font-black uppercase leading-none tracking-[0.1em] text-[#1f6b4a]">
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square"><path d="M2 6l3 3 5-5" /></svg>
        {count}/{needed} picks
      </span>
    )
  }
  return (
    <span className="inline-flex min-h-6 items-center gap-1 whitespace-nowrap border border-[#b58a3a] bg-[#fff4cf] px-2 py-1 text-[10px] font-black uppercase leading-none tracking-[0.1em] text-[#7a5a19]">
      <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="square"><circle cx="6" cy="6" r="4.5" /><path d="M6 3.5v3M6 7.5v1" /></svg>
      {count}/{needed} picks
    </span>
  )
}

function LockTimeBadge({ pool, tournament }: { pool: PoolRecord; tournament: Tournament | null }) {
  const formatted = getPickLockBadgeText({
    lockAt: pool.lock_at,
    groupsFinalizedAt: pool.groups_finalized_at,
    tournamentStartDate: tournament?.start_date,
    fieldJson: tournament?.field_json,
  })
  if (!formatted) return null
  return (
    <span className="inline-flex min-h-6 items-center whitespace-nowrap border border-[#f0c8c3] bg-[#fff1ef] px-2 py-1 text-[10px] font-black uppercase leading-none tracking-[0.1em] text-[#b21e23]">
      Lock {formatted} ET
    </span>
  )
}

export default function DashboardActivePools({ cards, entriesByPool, mode = 'player', snapshot = false, userId = null }: { cards: ActivePoolCard[]; entriesByPool: Record<string, EntryRecord[]>; mode?: 'player' | 'runner'; snapshot?: boolean; userId?: string | null }) {
  const router = useRouter()
  const viewStateKey = dashboardActivePoolsViewStateKey(mode)
  const [expandedPoolIds, setExpandedPoolIds] = useState<Set<string>>(() => initialExpandedPoolIds(cards, viewStateKey))
  const [expandedEntryIds, setExpandedEntryIds] = useState<Record<string, Set<string>>>(() => initialExpandedEntryIds(cards, viewStateKey))
  const [liveLeaderboardsByExternalId, setLiveLeaderboardsByExternalId] = useState<Record<string, LiveTournamentPayload>>({})
  const [teeTimeZone, setTeeTimeZone] = useState(DEFAULT_TEE_TIME_ZONE)
  const [nowMs, setNowMs] = useState<number | null>(null)
  const [poolOrder, setPoolOrder] = useState<string[]>(() => cards.map(card => card.pool.id))
  const [poolOrderHydrated, setPoolOrderHydrated] = useState(false)
  const [sortMode, setSortMode] = useState(false)
  const [sortAutoExpandSuppressed, setSortAutoExpandSuppressed] = useState(false)
  const [pageVisibilityState, setPageVisibilityState] = useState<DashboardVisibilityState>(() => typeof document === 'undefined' ? 'visible' : document.visibilityState)
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine)
  const lastMetadataRefreshRef = useRef(0)

  const storageKey = `${DASHBOARD_POOL_ORDER_STORAGE_KEY}:${mode}`
  const activeCardIds = useMemo(() => cards.map(card => card.pool.id), [cards])
  const orderedPoolIds = useMemo(() => applySavedPoolOrder(poolOrder, activeCardIds), [poolOrder, activeCardIds])
  const orderedCards = useMemo(() => {
    const cardByPoolId = new Map(cards.map(card => [card.pool.id, card]))
    return orderedPoolIds.map(poolId => cardByPoolId.get(poolId)).filter((card): card is ActivePoolCard => Boolean(card))
  }, [cards, orderedPoolIds])

  const reorderPool = (draggedId: string, targetId: string) => {
    setPoolOrder(current => movePoolId(applySavedPoolOrder(current, activeCardIds), draggedId, targetId))
  }

  useEffect(() => {
    const updateBrowserState = () => {
      setPageVisibilityState(typeof document === 'undefined' ? 'visible' : document.visibilityState)
      setOnline(typeof navigator === 'undefined' ? true : navigator.onLine)
    }

    updateBrowserState()
    document.addEventListener('visibilitychange', updateBrowserState)
    window.addEventListener('online', updateBrowserState)
    window.addEventListener('offline', updateBrowserState)
    return () => {
      document.removeEventListener('visibilitychange', updateBrowserState)
      window.removeEventListener('online', updateBrowserState)
      window.removeEventListener('offline', updateBrowserState)
    }
  }, [])

  const activeExternalIds = useMemo(() => dashboardLiveTournamentExternalIds(cards), [cards])
  const liveBootstrapExternalIds = useMemo(() => dashboardMissingLiveTournamentExternalIds(cards), [cards])
  const livePollingEnabled = shouldPollDashboardLiveScores({
    snapshot,
    visibilityState: pageVisibilityState,
    online,
    liveTournamentIds: activeExternalIds,
  })

  useEffect(() => {
    if (!livePollingEnabled) return
    let cancelled = false

    async function fetchLiveLeaderboards() {
      if (!shouldPollDashboardLiveScores({
        snapshot,
        visibilityState: typeof document === 'undefined' ? 'visible' : document.visibilityState,
        online: typeof navigator === 'undefined' ? true : navigator.onLine,
        liveTournamentIds: activeExternalIds,
      })) return

      const nextEntries = await Promise.all(activeExternalIds.map(async externalId => {
        try {
          const res = await fetch(`/api/tournaments/leaderboard?id=${encodeURIComponent(externalId)}`)
          if (!res.ok) return [externalId, null] as const
          const data = await res.json()
          return [externalId, { leaderboard: data.leaderboard || null, cutLine: data.cutLine || null, lastScoresFetch: data.lastScoresFetch || null }] as const
        } catch {
          return [externalId, null] as const
        }
      }))
      if (cancelled) return
      setLiveLeaderboardsByExternalId(current => {
        const next = { ...current }
        for (const [externalId, payload] of nextEntries) {
          if (payload?.leaderboard?.length) next[externalId] = payload
        }
        return next
      })
    }

    if (liveBootstrapExternalIds.length > 0) fetchLiveLeaderboards()
    const intervalId = window.setInterval(fetchLiveLeaderboards, DASHBOARD_LIVE_SCORE_POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [activeExternalIds, liveBootstrapExternalIds, livePollingEnabled, snapshot])

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (detected) setTeeTimeZone(detected)
  }, [])

  useEffect(() => {
    const updateNow = () => setNowMs(Date.now())
    updateNow()
    const intervalId = window.setInterval(updateNow, 30000)
    return () => window.clearInterval(intervalId)
  }, [])

  const metadataRefreshEnabled = shouldRefreshDashboardMetadata({
    snapshot,
    visibilityState: pageVisibilityState,
    online,
    hasDashboardCards: cards.length > 0,
  })

  useEffect(() => {
    if (!metadataRefreshEnabled) return

    const refreshDashboardMetadata = () => {
      if (!shouldRefreshDashboardMetadata({
        snapshot,
        visibilityState: typeof document === 'undefined' ? 'visible' : document.visibilityState,
        online: typeof navigator === 'undefined' ? true : navigator.onLine,
        hasDashboardCards: cards.length > 0,
      })) return

      const now = Date.now()
      if (now - lastMetadataRefreshRef.current < 30 * 1000) return
      lastMetadataRefreshRef.current = now
      const scrollPosition = saveDashboardScrollPosition(viewStateKey)
      router.refresh()
      scheduleDashboardScrollRestore(scrollPosition.scrollY, scrollPosition.scrollX, scrollPosition.anchorKey, scrollPosition.anchorOffset)
    }

    const intervalId = window.setInterval(refreshDashboardMetadata, DASHBOARD_METADATA_REFRESH_INTERVAL_MS)
    const refreshOnVisible = () => {
      if (document.visibilityState !== 'hidden') refreshDashboardMetadata()
    }
    window.addEventListener('online', refreshDashboardMetadata)
    document.addEventListener('visibilitychange', refreshOnVisible)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('online', refreshDashboardMetadata)
      document.removeEventListener('visibilitychange', refreshOnVisible)
    }
  }, [cards.length, metadataRefreshEnabled, router, snapshot, viewStateKey])

  useEffect(() => {
    if (snapshot) return
    restoreSavedDashboardScroll(viewStateKey)
  }, [cards, snapshot, viewStateKey])

  useEffect(() => {
    if (cards.length === 0) return
    writeDashboardActivePoolsViewState(viewStateKey, {
      expandedPoolIds: [...expandedPoolIds],
      expandedEntryIds: serializeExpandedEntryIds(expandedEntryIds),
    })
  }, [cards.length, expandedPoolIds, expandedEntryIds, viewStateKey])

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey)
      if (!saved) return
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
        setPoolOrder(applySavedPoolOrder(parsed, activeCardIds))
      }
    } catch {
      // Ignore bad local dashboard order data.
    } finally {
      setPoolOrderHydrated(true)
    }
  }, [activeCardIds, storageKey])

  useEffect(() => {
    setPoolOrder(current => applySavedPoolOrder(current, activeCardIds))
  }, [activeCardIds])

  const defaultTopPoolId = cards[0]?.pool.id

  useEffect(() => {
    const savedTopPoolId = orderedPoolIds[0]
    if (!poolOrderHydrated || !savedTopPoolId || sortMode || sortAutoExpandSuppressed) return

    setExpandedPoolIds(current => {
      if (current.size === 0) return new Set([savedTopPoolId])
      if (defaultTopPoolId && current.size === 1 && current.has(defaultTopPoolId)) return new Set([savedTopPoolId])
      return current
    })
  }, [defaultTopPoolId, orderedPoolIds, poolOrderHydrated, sortAutoExpandSuppressed, sortMode])

  useEffect(() => {
    if (!poolOrderHydrated) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(orderedPoolIds))
    } catch {
      // Reordering is a convenience. Do not block the dashboard if storage is unavailable.
    }
  }, [orderedPoolIds, poolOrderHydrated, storageKey])

  const displayCards = useMemo(() => orderedCards.map(card => {
    const { pool, tournament, entry } = card
    const livePayload = tournament?.external_id ? liveLeaderboardsByExternalId[tournament.external_id] : null
    const effectiveTournament = tournament && livePayload?.leaderboard?.length
      ? { ...tournament, leaderboard_json: livePayload.leaderboard, cutLine: livePayload.cutLine ?? tournament.cutLine ?? null }
      : tournament
    const effectivePool = effectiveTournament ? { ...pool, gpp_tournaments: effectiveTournament } : pool
    const poolEntries = entriesByPool[pool.id] || (entry ? [entry] : [])
    const rankPreview = entry ? buildRankPreview(entry, effectivePool, poolEntries) : buildLeaderPreview(effectivePool, poolEntries)
    return {
      ...card,
      effectiveTournament,
      effectivePool,
      poolEntries,
      rankPreview,
      label: statusLabel(effectivePool, effectiveTournament),
      eventBegun: hasEventBegun(effectiveTournament),
      tournamentDisplayName: displayTournamentName(effectiveTournament?.name) || 'Tournament',
    }
  }), [entriesByPool, liveLeaderboardsByExternalId, orderedCards])

  const cardsForCache = useMemo(() => displayCards.map(({ role, entry, effectivePool, effectiveTournament }) => ({
    pool: effectivePool,
    tournament: effectiveTournament,
    role,
    entry,
  })), [displayCards])

  useEffect(() => {
    if (snapshot || mode !== 'player' || cardsForCache.length === 0 || !userId) return
    try {
      window.localStorage.setItem(dashboardActivePoolsCacheStorageKey(mode, userId), JSON.stringify({
        version: DASHBOARD_ACTIVE_POOLS_CACHE_VERSION,
        cachedAt: Date.now(),
        userId,
        cards: cardsForCache,
        entriesByPool,
      }))
      window.localStorage.removeItem(dashboardActivePoolsCacheStorageKey(mode))
    } catch {
      // Snapshot restore is best-effort. The live dashboard still works without local storage.
    }
  }, [cardsForCache, entriesByPool, mode, snapshot, userId])

  useEffect(() => {
    if (cards.length === 0) return
    trackGppEvent(snapshot ? 'dashboard_cached_snapshot_shown' : 'dashboard_viewed', {
      mode,
      pool_count: cards.length,
      live_pool_count: cards.filter(card => hasEventBegun(card.tournament)).length,
      incomplete_entry_count: cards.filter(card => {
        const entry = card.entry
        if (!entry) return false
        const requiredPicks = totalPicksRequired(card.pool)
        const submittedPicks = Array.isArray(entry.golfer_picks) ? entry.golfer_picks.length : 0
        return requiredPicks > 0 && submittedPicks < requiredPicks
      }).length,
    })
  }, [cards, mode, snapshot])

  const activePoolIds = useMemo(() => new Set(activeCardIds), [activeCardIds])
  const canSortPools = mode === 'player' && orderedCards.length > 1
  const useSinglePoolMobileLayout = mode === 'player' && orderedCards.length === 1

  function handleSortModeToggle() {
    setExpandedPoolIds(new Set())
    setSortAutoExpandSuppressed(true)
    setSortMode(current => !current)
  }

  useEffect(() => {
    setExpandedPoolIds(current => {
      const filtered = new Set([...current].filter(poolId => activePoolIds.has(poolId)))
      return filtered
    })
    setExpandedEntryIds(current => {
      const next: Record<string, Set<string>> = {}
      for (const [poolId, entryIds] of Object.entries(current)) {
        if (activePoolIds.has(poolId)) next[poolId] = entryIds
      }
      return next
    })
  }, [activePoolIds, cards])

  useEffect(() => {
    if (canSortPools) return
    setSortMode(false)
  }, [canSortPools])

  if (cards.length === 0) return null

  return (
    <section data-dashboard-active-pools="true" className={useSinglePoolMobileLayout ? 'border-0 bg-transparent shadow-none sm:border-2 sm:border-[#123c2f] sm:bg-white sm:shadow-[7px_7px_0_#d8cab0]' : 'border-2 border-[#123c2f] bg-white shadow-[7px_7px_0_#d8cab0]'}>
      <div className={`${useSinglePoolMobileLayout ? 'hidden sm:flex' : 'flex'} items-center justify-between gap-3 border-b border-[#d8cab0] bg-[#123c2f] px-3 py-2 text-white sm:px-5 sm:py-3`}>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#d7c99f] sm:text-xs sm:tracking-[0.22em]">Active pools</h2>
        <div className="flex items-center gap-2">
          {canSortPools ? (
            <button
              type="button"
              onClick={handleSortModeToggle}
              className={`border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${sortMode ? 'border-white bg-white text-[#123c2f]' : 'border-[#d7c99f] text-[#f3df9c]'}`}
              aria-pressed={sortMode}
            >
              {sortMode ? 'Done' : 'Sort'}
            </button>
          ) : null}
        </div>
      </div>
      <div className={useSinglePoolMobileLayout ? 'sm:divide-y sm:divide-[#eadfca]' : 'divide-y divide-[#eadfca]'}>
        {displayCards.map(({ pool, role, entry, effectiveTournament, effectivePool, poolEntries, rankPreview, label, eventBegun, tournamentDisplayName }, index) => {
          const openEntryIds = expandedEntryIds[pool.id] ?? null
          const scoresAreLive = hasRecentScores(effectiveTournament, nowMs)
          const canReorderPools = canSortPools && sortMode
          const isPoolOpen = !canReorderPools && (useSinglePoolMobileLayout || expandedPoolIds.has(pool.id))
          return (
            <details
              key={`${role}-${pool.id}`}
              open={isPoolOpen}
              onToggle={event => {
                const open = event.currentTarget.open
                setExpandedPoolIds(current => {
                  const next = new Set(current)
                  if (open) next.add(pool.id)
                  else next.delete(pool.id)
                  return next
                })
              }}
              data-dashboard-scroll-anchor={`pool:${pool.id}`}
              className={`${useSinglePoolMobileLayout ? 'bg-transparent sm:bg-white' : index % 2 === 0 ? 'bg-white' : 'bg-[#fbf7ed]'} group`}
            >
              <summary
                onClick={event => {
                  if (canReorderPools) event.preventDefault()
                }}
                className={`${useSinglePoolMobileLayout ? 'hidden sm:block' : 'block'} cursor-pointer list-none px-2.5 py-2 transition-colors hover:bg-[#fff8e8] sm:px-5 sm:py-3 [&::-webkit-details-marker]:hidden`}
              >
                <div className={`grid min-h-10 min-w-0 items-center gap-1.5 sm:min-h-11 sm:gap-2 ${eventBegun ? 'grid-cols-[32px_minmax(0,1fr)_90px] sm:grid-cols-[40px_minmax(0,1fr)_110px]' : 'grid-cols-[32px_minmax(0,1fr)_auto] sm:grid-cols-[40px_minmax(0,1fr)_auto]'}`}>
                  <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center border border-[#123c2f] ${isPoolOpen ? 'bg-[#123c2f] text-white' : 'bg-white text-[#123c2f]'} sm:h-9 sm:w-9`} aria-label={isPoolOpen ? 'Collapse pool' : 'Expand pool'}>
                    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d={isPoolOpen ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'} stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" /></svg>
                  </span>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <p className="min-w-0 flex-1 truncate pb-0.5 text-lg font-black leading-tight text-[#0f2f25] sm:text-xl" title={pool.name}>{pool.name}</p>
                    {canReorderPools ? (
                      <span className="inline-flex shrink-0 flex-col border border-[#123c2f] bg-white text-[#123c2f]">
                          <button
                            type="button"
                            onClick={event => {
                              event.preventDefault()
                              event.stopPropagation()
                              const previousPoolId = displayCards[index - 1]?.pool.id
                              if (previousPoolId) reorderPool(pool.id, previousPoolId)
                            }}
                            disabled={index === 0}
                            className="flex h-4 w-5 items-center justify-center border-b border-[#d8cab0] disabled:cursor-not-allowed disabled:text-[#b7bdb6] disabled:opacity-50"
                            aria-label={`Move ${pool.name} up`}
                            title="Move up"
                          >
                            <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 10l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" /></svg>
                          </button>
                          <button
                            type="button"
                            onClick={event => {
                              event.preventDefault()
                              event.stopPropagation()
                              const nextPoolId = displayCards[index + 1]?.pool.id
                              if (nextPoolId) reorderPool(nextPoolId, pool.id)
                            }}
                            disabled={index === displayCards.length - 1}
                            className="flex h-4 w-5 items-center justify-center disabled:cursor-not-allowed disabled:text-[#b7bdb6] disabled:opacity-50"
                            aria-label={`Move ${pool.name} down`}
                            title="Move down"
                          >
                            <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" /></svg>
                          </button>
                      </span>
                    ) : null}
                  </div>
                  {!eventBegun ? (
                    <div className="flex min-w-0 justify-center">
                      {label !== 'Open' ? <StatusBadge label={label} locked={Boolean(pool.is_locked)} /> : null}
                    </div>
                  ) : null}
                  {eventBegun ? (
                    <div className={`flex min-h-10 w-full shrink-0 flex-col items-center justify-center border border-[#123c2f] bg-white px-1 text-[13px] font-black uppercase leading-none text-[#111] shadow-[1px_1px_0_#d8cab0] sm:min-h-11 sm:px-2 sm:text-base sm:shadow-[2px_2px_0_#d8cab0] ${label === 'Live' ? 'py-0.5' : 'py-1.5'}`}>
                      <div className="flex items-center gap-1 sm:gap-2">
                        {rankPreview?.rank ? <span className="text-[#123c2f]">#{rankPreview.rank}</span> : <span className="text-[#657168]">—</span>}
                        <span className="text-[#657168]">/</span>
                        <span className={scoreClass(rankPreview?.totalScore ?? null)}>{formatScore(rankPreview?.totalScore ?? null)}</span>
                      </div>
                      {label === 'Live' ? <LiveScoreStrip pulsing={scoresAreLive} /> : null}
                    </div>
                  ) : null}
                </div>
                <div className={`${canReorderPools || eventBegun ? 'hidden' : 'mt-1.5 flex'} min-w-0 flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.07em] text-[#657168] sm:gap-2 sm:text-[11px] sm:tracking-[0.1em]`}>
                  {!eventBegun && rankPreview?.rank ? <span className="whitespace-nowrap border border-[#b58a3a] bg-[#fff4cf] px-1.5 py-0.5 text-[#7a5a19] sm:px-2 sm:py-1">#{rankPreview.rank}</span> : null}
                  <MovementBadge movement={rankPreview?.movementToday ?? null} />
                  {entry ? <PickProgressBadge entry={entry} pool={pool} tournament={effectiveTournament} /> : null}
                  {!pool.is_locked && !pool.is_completed && !eventBegun ? <LockTimeBadge pool={pool} tournament={effectiveTournament} /> : null}
                </div>
              </summary>
              {isPoolOpen ? (
                <>
                  <InlineLeaderboard
                    pool={effectivePool}
                    entries={poolEntries}
                    currentEntryId={entry?.id}
                    openEntryIds={openEntryIds}
                    onEntryToggle={(entryId, open) => {
                      setExpandedEntryIds(current => {
                        const next = { ...current }
                        const entrySet = new Set(next[pool.id] ?? [])
                        if (open) entrySet.add(entryId)
                        else entrySet.delete(entryId)
                        next[pool.id] = entrySet
                        return next
                      })
                    }}
                    mode={mode}
                    viewStateKey={viewStateKey}
                    teeTimeZone={teeTimeZone}
                    nowMs={nowMs}
                  />
                  <div className="border-t border-[#eadfca] bg-[#fbf7ed] px-3 py-3 sm:px-5 sm:py-4">
                    <TournamentLeaderboard
                      leaderboard={effectiveTournament?.leaderboard_json?.length ? effectiveTournament.leaderboard_json : effectiveTournament?.field_json}
                      tournamentName={tournamentDisplayName}
                      lastUpdated={effectiveTournament?.last_scores_fetch}
                      defaultOpen
                      pickedGolfers={entryPicks(entry)}
                      cutLine={effectiveTournament?.cutLine}
                    />
                  </div>
                </>
              ) : null}
            </details>
          )
        })}
      </div>
    </section>
  )
}
