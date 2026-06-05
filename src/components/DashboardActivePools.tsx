'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { availableCompletedRounds, buildHarePickMap, buildTortoisePickMap, entryMovementSincePriorRank, leaderboardForCompletedRound, leaderboardForRoundOnly, normalizePickName, rankEntries, scoreEntry, type EntryMovement, type PickScore, type ScoredEntry } from '@/lib/scoring'
import { LeverageMarker, LeverageMarkerCorner, LeverageMarkerLegend, ObMarker, ObMarkerCorner } from '@/components/LeverageMarkers'
import { hasOnCourseScores } from '@/lib/golf-live'
import { formatDateOnly } from '@/lib/date-utils'
import { leaderboardBackedPickProgressLabel } from '@/lib/golfer-status'
import { TournamentLeaderboard } from '@/components/TournamentLeaderboard'
import { displayTournamentName } from '@/lib/tournament-name'
import { isGroupedPoolFormat, totalPicksRequired } from '@/lib/pick-counts'
import { getPickLockBadgeText } from '@/lib/pick-lock-display'
import { applySavedPoolOrder, movePoolId } from '@/lib/dashboard-pool-order'
import { trackGppEvent } from '@/lib/posthog-events'
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
}

type RankPreview = {
  rank: number | null
  totalScore: number | null
  todayScore: number | null
  movementToday: EntryMovement | null
}

const DEFAULT_TEE_TIME_ZONE = 'America/New_York'
const DASHBOARD_POOL_ORDER_STORAGE_KEY = 'gpp-dashboard-active-pool-order'
export const DASHBOARD_ACTIVE_POOLS_CACHE_KEY = 'gpp-dashboard-active-pools-cache'
const DASHBOARD_ACTIVE_POOLS_CACHE_VERSION = 1
const ROUND_MENU_LABELS: Record<number, string> = { 1: 'THURSDAY', 2: 'FRIDAY', 3: 'SATURDAY', 4: 'SUNDAY' }
const ROUND_SCORE_LABELS: Record<number, string> = { 1: 'THU', 2: 'FRI', 3: 'SAT', 4: 'SUN' }

type LeaderboardMode = { type: 'current' } | { type: 'thru'; round: number } | { type: 'day'; round: number }

function roundMenuLabel(round: number) {
  return ROUND_MENU_LABELS[round] || `ROUND ${round}`
}

function roundScoreLabel(round: number) {
  return ROUND_SCORE_LABELS[round] || `R${round}`
}

function selectedBoardLabel(mode: LeaderboardMode) {
  if (mode.type === 'current') return 'Current'
  if (mode.type === 'thru') return `Thru ${roundMenuLabel(mode.round)}`
  return roundMenuLabel(mode.round)
}

function statusLabel(pool: PoolRecord, tournament: Tournament | null) {
  if (pool.is_completed || tournament?.status === 'completed') return 'Passed'
  if (tournament?.status === 'live') return 'Live'
  if (pool.is_locked) return 'Locked'
  return 'Open'
}

function statusClass(label: string) {
  if (label === 'Live') return 'border-[#1f6b4a] bg-[#123c2f] text-white'
  if (label === 'Locked') return 'border-[#b58a3a] bg-[#fbf0c9] text-[#7a5a19]'
  if (label === 'Passed') return 'border-[#d8cab0] bg-[#f3ede0] text-[#657168]'
  return 'border-[#cfe0d3] bg-[#eef7ef] text-[#1f6b4a]'
}

function hasRecentScores(tournament: Tournament | null) {
  if (tournament?.status !== 'live' || !tournament.last_scores_fetch) return false
  if (!hasOnCourseScores(tournament.leaderboard_json)) return false
  const lastFetchMs = new Date(tournament.last_scores_fetch).getTime()
  if (!Number.isFinite(lastFetchMs)) return false
  return Date.now() - lastFetchMs <= 5 * 60 * 1000
}

function hasEventBegun(tournament: Tournament | null) {
  if (tournament?.status === 'live' || tournament?.status === 'completed') return true
  if (hasOnCourseScores(tournament?.leaderboard_json)) return true
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

function LivePulseBadge() {
  return (
    <span className="inline-flex items-center gap-1 border border-[#b21e23] bg-[#fff1ef] px-1.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#b21e23] sm:gap-1.5 sm:px-2 sm:text-xs sm:tracking-[0.12em]">
      <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping bg-[#b21e23] opacity-70" />
        <span className="relative inline-flex h-full w-full bg-[#b21e23]" />
      </span>
      Live
    </span>
  )
}

function scoreBadgeClass(score: number | null | undefined) {
  if (typeof score === 'number' && score < 0) return 'border-[#b21e23] bg-[#fff1ef] text-[#b21e23]'
  return 'border-[#d8cab0] bg-white text-[#111]'
}

function formatScoreFreshness(value?: string | null) {
  if (!value) return null
  const updatedMs = new Date(value).getTime()
  if (!Number.isFinite(updatedMs)) return null
  const diffSeconds = Math.max(0, Math.floor((Date.now() - updatedMs) / 1000))
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
    <span className={`inline-flex items-center gap-0.5 ${up ? 'text-[#1f6b4a]' : 'text-[#b21e23]'}`}>
      <svg aria-hidden="true" viewBox="0 0 14 14" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="square" strokeLinejoin="miter">
        <path d={up ? 'M7 12V2M3 6l4-4 4 4' : 'M7 2v10M3 8l4 4 4-4'} />
      </svg>
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

function scoreClass(score: number | null) {
  if (score === null) return 'text-stone-400'
  return score < 0 ? 'text-[#b21e23]' : 'text-[#111]'
}

function lastNameFor(name: string) {
  const clean = name.replace(/^OB Stand-in #/, 'OB ')
  if (clean.startsWith('OB ')) return clean
  const parts = clean.split(' ').filter(Boolean)
  return parts.length > 1 ? parts[parts.length - 1] : clean
}

function shortName(name: string, peerNames: string[] = []) {
  if (name === 'Picks hidden') return 'Hidden'
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

function OpenPicksBar({ pool, tournament, mode }: { pool: PoolRecord; tournament: Tournament | null; mode: 'player' | 'runner' }) {
  if (mode === 'player') return null
  if (!poolIsOpenForPicks(pool, tournament)) return null
  const href = mode === 'runner' ? `/pool/${pool.id}?tab=pool-settings` : `/pool/${pool.id}#make-picks`
  const label = mode === 'runner' ? 'Settings' : 'Edit picks'
  return (
    <div className="mb-3 flex items-center justify-between gap-2 border border-[#d8cab0] bg-white px-2 py-2 text-[clamp(0.58rem,2.25vw,0.75rem)] font-black uppercase tracking-[0.08em] text-[#123c2f] sm:px-3">
      <span className="min-w-0 whitespace-nowrap text-[#657168]">Event starts: <span className="text-[#123c2f]">{formatEventDate(tournament?.start_date)}</span></span>
      <a href={href} className="inline-flex shrink-0 items-center gap-1 border border-[#123c2f] bg-[#fbf7ed] px-2 py-1.5 text-[#123c2f] hover:bg-[#fff4cf] sm:px-3" aria-label={mode === 'runner' ? `Open settings for ${pool.name}` : `Edit picks for ${pool.name}`}>
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
  const canShowRank = forceScoring || Boolean(pool.is_locked || tournament?.status === 'live' || tournament?.status === 'completed' || hasOnCourseScores(leaderboard))

  if (!canShowRank || leaderboard.length === 0) return []

  return rankEntries(
    allEntries.map(poolEntry => ({
      ...scoreEntry(
        Array.isArray(poolEntry.golfer_picks) ? poolEntry.golfer_picks as string[] : [],
        leaderboard,
        {
          countScores: pool.count_scores || 4,
          obRuleEnabled: Boolean(pool.ob_rule_enabled),
          obPenaltyStrokes: pool.ob_penalty_strokes || 2,
        }
      ),
      entryId: poolEntry.id,
      displayName: poolEntry.display_name || 'Entry',
    }))
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

function pickGridColumnCount(count: number) {
  if (count <= 3) return Math.max(1, count)
  if (count === 6) return 3
  if (count === 12) return 4
  if (count % 5 === 0) return 5
  if (count % 4 === 0) return 4
  if (count % 3 === 0) return 3
  return Math.min(4, count)
}

function buildPreScoringEntry(entry: EntryRecord, countScores: number, hidePicks: boolean): ScoredEntry {
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

  const orderedPicks = (Array.isArray(entry.golfer_picks) ? [...entry.golfer_picks] as string[] : []).sort((a, b) => a.localeCompare(b))
  const pickScores = Array.from({ length: countScores }, (_, index) => {
    const name = orderedPicks[index]
    return {
      name: name || '—',
      scoreToPar: null,
      strokes: null,
      thru: '',
      status: 'active' as const,
      counted: true,
      isObStandIn: false,
    }
  })

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

function InlineLeaderboard({ pool, entries, currentEntryId, openEntryIds, onEntryToggle, teeTimeZone, mode }: {
  pool: PoolRecord
  entries: EntryRecord[]
  currentEntryId?: string | null
  openEntryIds: Set<string> | null
  onEntryToggle: (entryId: string, open: boolean) => void
  teeTimeZone: string
  mode: 'player' | 'runner'
}) {
  const countScores = pool.count_scores || 4
  const tournament = Array.isArray(pool.gpp_tournaments) ? pool.gpp_tournaments[0] ?? null : pool.gpp_tournaments ?? null
  const baseLeaderboardRows = Array.isArray(tournament?.leaderboard_json) ? tournament.leaderboard_json : []
  const fieldRows = Array.isArray(tournament?.field_json) ? tournament.field_json : []
  const [leaderboardMode, setLeaderboardMode] = useState<LeaderboardMode>({ type: 'current' })
  const [leaderboardMenuOpen, setLeaderboardMenuOpen] = useState(false)
  const availableHistoricalRounds = useMemo(() => availableCompletedRounds(baseLeaderboardRows), [baseLeaderboardRows])
  useEffect(() => {
    if (leaderboardMode.type !== 'current' && !availableHistoricalRounds.includes(leaderboardMode.round)) setLeaderboardMode({ type: 'current' })
  }, [availableHistoricalRounds, leaderboardMode])
  const leaderboardRows = useMemo(() => {
    if (leaderboardMode.type === 'thru') return leaderboardForCompletedRound(baseLeaderboardRows, leaderboardMode.round)
    if (leaderboardMode.type === 'day') return leaderboardForRoundOnly(baseLeaderboardRows, leaderboardMode.round)
    return baseLeaderboardRows
  }, [baseLeaderboardRows, leaderboardMode])
  const leaderboardModeIsCurrent = leaderboardMode.type === 'current'
  const boardLabel = selectedBoardLabel(leaderboardMode)
  const selectedBoardIsHistorical = !leaderboardModeIsCurrent
  const totalScoreSubLabel = leaderboardMode.type === 'current'
    ? (availableHistoricalRounds.length > 0 || isAfterOpeningRoundDate(tournament)) ? 'TODAY' : null
    : leaderboardMode.type === 'thru' && leaderboardMode.round > 1
      ? roundScoreLabel(leaderboardMode.round)
      : null
  const scoringIsLive = leaderboardRows.length > 0 && Boolean(pool.is_locked || tournament?.status === 'live' || tournament?.status === 'completed' || hasOnCourseScores(leaderboardRows))
  const scoredEntries = scoringIsLive
    ? buildScoredEntries(pool, entries, leaderboardRows, selectedBoardIsHistorical)
    : entries.map(entry => buildPreScoringEntry(entry, countScores, entry.id !== currentEntryId && Boolean(entry.picks_hidden)))
  const pickGridColumns = pickGridColumnCount(countScores)
  const leaderboardByName = playerStatusByName(leaderboardRows, fieldRows)
  const golferNamePeers = leaderboardRows
    .map(player => player.name || `${player.firstName || ''} ${player.lastName || ''}`.trim())
    .filter(Boolean)
  const currentScoredEntry = currentEntryId ? scoredEntries.find(entry => entry.entryId === currentEntryId) : null
  const currentEntryRecord = currentEntryId ? entries.find(entry => entry.id === currentEntryId) : null
  const priorMovementRound = leaderboardModeIsCurrent ? priorCompletedRoundForMovement(baseLeaderboardRows) : null
  const priorMovementEntries = priorMovementRound
    ? buildScoredEntries(pool, entries, leaderboardForCompletedRound(baseLeaderboardRows, priorMovementRound), true)
    : []
  const currentMovementToday = currentScoredEntry && leaderboardModeIsCurrent && priorMovementEntries.length > 0
    ? entryMovementSincePriorRank(currentScoredEntry, priorMovementEntries)
    : null
  const scoreFreshness = formatScoreFreshness(tournament?.last_scores_fetch)
  const boardSectionRef = useRef<HTMLDivElement>(null)
  const fixedMyEntryBarRef = useRef<HTMLDivElement>(null)
  const [fixedMyEntryBarState, setFixedMyEntryBarState] = useState<'before' | 'shown' | 'after'>('before')
  const harePickMap = leaderboardModeIsCurrent ? buildHarePickMap(scoredEntries, 2) : new Map()
  const tortoisePickMap = leaderboardModeIsCurrent ? buildTortoisePickMap(scoredEntries, currentEntryId, 2) : new Map()
  const showLeverageLegend = leaderboardModeIsCurrent && (harePickMap.size > 0 || tortoisePickMap.size > 0)
  const showMyEntryBar = mode === 'player' && scoringIsLive && Boolean(currentScoredEntry)
  const showJumpToMyEntry = mode === 'player' && scoringIsLive && Boolean(currentScoredEntry && scoredEntries.length >= 10)

  useEffect(() => {
    if (!showMyEntryBar) {
      setFixedMyEntryBarState('before')
      return
    }

    const updateFixedBar = () => {
      if (window.matchMedia('(min-width: 640px)').matches) {
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
  }, [showMyEntryBar])

  const fixedMyEntryBarClass = fixedMyEntryBarState === 'shown'
    ? 'translate-y-0 opacity-100'
    : fixedMyEntryBarState === 'after'
      ? 'translate-y-0 opacity-0 pointer-events-none'
      : '-translate-y-[calc(100%+1rem)] opacity-0 pointer-events-none'

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
        <OpenPicksBar pool={pool} tournament={tournament} mode={mode} />
      </div>
    )
  }

  return (
    <div ref={boardSectionRef} className="overflow-visible border-t border-[#eadfca] bg-[#fbf7ed] px-2 pb-0 pt-2 sm:px-5 sm:pt-4">
      {showMyEntryBar && currentScoredEntry ? (
        <div
          ref={fixedMyEntryBarRef}
          aria-hidden="true"
          className={`fixed left-6 right-6 top-[calc(env(safe-area-inset-top)+0.5rem)] z-[240] flex items-center justify-between gap-1.5 border-2 border-[#123c2f] bg-white px-2 py-2 text-[clamp(0.58rem,2.2vw,0.75rem)] font-black uppercase tracking-[0.08em] shadow-[2px_2px_0_#d8cab0] transition-[transform,opacity] duration-200 ease-out sm:hidden ${fixedMyEntryBarClass}`}
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="inline-flex shrink-0 items-center gap-1 text-[#123c2f]"><CurrentUserMarker /> My entry</span>
            <span className="border border-[#b58a3a] bg-[#fff4cf] px-2 py-1 text-[#7a5a19]">#{currentScoredEntry.rank || '—'}</span>
            <span className={`border px-2 py-1 ${scoreBadgeClass(currentScoredEntry.totalScore)}`}>{formatScore(currentScoredEntry.totalScore)}</span>
            <TodayMovementBadge label={totalScoreSubLabel} score={currentScoredEntry.todayScore} movement={currentMovementToday} />
          </div>
        </div>
      ) : null}
      <OpenPicksBar pool={pool} tournament={tournament} mode={mode} />
      {showMyEntryBar && currentScoredEntry ? (
        <div className="mb-3 flex items-center justify-between gap-1.5 border-2 border-[#123c2f] bg-white px-2 py-2 text-[clamp(0.58rem,2.2vw,0.75rem)] shadow-[3px_3px_0_#d8cab0] sm:px-3">
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
        className="gpp-3d [--gpp-depth-x:10px] [--gpp-depth-y:8px] [--gpp-side-color:#001f17] [--gpp-bottom-color:#001f17] md:[--gpp-depth-x:18px] md:[--gpp-depth-y:12px]"
        style={{ fontFamily: 'Arial Narrow, Arial, sans-serif' }}
      >
        <div className="gpp-board-depth-right" aria-hidden="true" />
        <div className="gpp-board-depth-bottom" aria-hidden="true" />
        <div className="gpp-3d-face gpp-board-frame border-[8px] border-[#123c2f] md:border-[14px]">
          <div className="gpp-score-face border-2 border-[#111] bg-[#f7f7f2] text-center">
            <div className="relative border-b-2 border-[#111] px-3 py-2">
              <p className="mx-auto max-w-[94%] text-[clamp(0.8rem,5vw,1.25rem)] font-black uppercase leading-[0.95] tracking-[clamp(0.025em,1.1vw,0.1em)] text-[#111] [text-wrap:balance] sm:text-2xl sm:tracking-[0.16em]" title={boardTitle(tournament)}>{boardTitle(tournament)}</p>
              <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.12em] text-[#005b3c] sm:text-xs">{pool.name}</p>
              <div className="mt-1 flex w-full flex-wrap items-center justify-center gap-1.5">
                {showJumpToMyEntry ? (
                  <button type="button" onClick={jumpToCurrentEntry} className="inline-flex border-2 border-[#123c2f] bg-white px-2 py-1 text-[9px] font-black uppercase leading-none tracking-[0.08em] text-[#123c2f] shadow-[2px_2px_0_#d8cab0] hover:bg-[#fff4cf] sm:px-2.5 sm:text-[10px]">
                    My row
                  </button>
                ) : null}
                {availableHistoricalRounds.length > 0 && (
                  <details
                    className="relative z-50 text-left"
                    open={leaderboardMenuOpen}
                    onToggle={event => setLeaderboardMenuOpen(event.currentTarget.open)}
                  >
                    <summary className="list-none border-2 border-[#123c2f] bg-white px-2 py-1 text-[9px] font-black uppercase leading-none tracking-[0.08em] text-[#123c2f] shadow-[2px_2px_0_#d8cab0] marker:hidden sm:px-2.5 sm:text-[10px] [&::-webkit-details-marker]:hidden">
                      <span className="text-[#657168]">View</span> {boardLabel}
                      <span className="ml-1 inline-block text-[#123c2f]">▾</span>
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
                          <div className="px-3 pb-1 pt-2 text-[9px] text-[#657168]">{roundMenuLabel(round)}</div>
                          <button
                            type="button"
                            onClick={() => { setLeaderboardMode({ type: 'thru', round }); setLeaderboardMenuOpen(false) }}
                            className={`block w-full px-3 py-2 text-left ${leaderboardMode.type === 'thru' && leaderboardMode.round === round ? 'bg-[#fbf7ed] shadow-[inset_4px_0_0_#b58a3a]' : ''}`}
                          >
                            Scores Through
                          </button>
                          <button
                            type="button"
                            onClick={() => { setLeaderboardMode({ type: 'day', round }); setLeaderboardMenuOpen(false) }}
                            className={`block w-full px-3 py-2 text-left ${leaderboardMode.type === 'day' && leaderboardMode.round === round ? 'bg-[#fbf7ed] shadow-[inset_4px_0_0_#b58a3a]' : ''}`}
                          >
                            Daily Winner
                          </button>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                {scoreFreshness ? <span className="hidden text-[9px] font-black uppercase leading-none tracking-[0.08em] text-[#657168] sm:inline">{scoreFreshness}</span> : null}
              </div>
              {selectedBoardIsHistorical ? <p className="mt-1 text-[9px] font-black uppercase tracking-[0.1em] text-[#657168]">{leaderboardMode.type === 'day' ? `${boardLabel} daily scores only` : `Standings through ${boardLabel.replace('Thru ', '')}`}</p> : null}
            </div>
            <div className="bg-[#f7f7f2] lg:hidden">
              {scoredEntries.map((entry, entryIndex) => {
                const countingPicks = entry.pickScores.filter(pick => pick.counted).slice(0, countScores)
                const outOfBoundsPicks = entry.pickScores.filter(pick => !pick.counted)
                const allPickNames = golferNamePeers
                const isCurrentEntry = entry.entryId === currentEntryId
                const hareNames = isCurrentEntry ? harePickMap.get(entry.entryId) : undefined
                const tortoiseNames = !isCurrentEntry ? tortoisePickMap.get(entry.entryId) : undefined
                const isOpen = openEntryIds ? openEntryIds.has(entry.entryId) : (entry.entryId === currentEntryId || (!currentEntryId && entryIndex === 0))
                const picksHidden = entry.picks.includes('__hidden__')
                return (
                  <details data-dashboard-entry-id={isCurrentEntry ? entry.entryId : undefined} id={isCurrentEntry ? `dashboard-entry-${entry.entryId}` : undefined} key={entry.entryId} open={isOpen} onToggle={event => onEntryToggle(entry.entryId, event.currentTarget.open)} className="scroll-mt-28 group border-b-2 border-[#111] last:border-b-0">
                    <summary className={`grid min-h-[54px] cursor-pointer list-none grid-cols-[30px_minmax(0,1fr)_50px_18px] items-center gap-1 px-2 py-1.5 text-left transition-colors hover:bg-[#fffdf4] group-open:bg-[#fffdf4] sm:min-h-[58px] sm:grid-cols-[44px_minmax(0,1fr)_74px_20px] sm:gap-2 sm:py-2 [&::-webkit-details-marker]:hidden ${isCurrentEntry ? 'bg-[#fff4cf] shadow-[inset_5px_0_0_#1f6b4a]' : 'bg-[#f7f7f2]'}`}>
                      <div className="text-center text-lg font-black text-[#b21e23] sm:text-xl">{entry.rank || '—'}</div>
                      <div className="min-w-0">
                        <span className="flex min-w-0 items-center gap-1.5">
                          {isCurrentEntry ? <CurrentUserMarker /> : null}
                          <span className="min-w-0 flex-1 truncate whitespace-nowrap text-base font-black uppercase leading-tight tracking-[0.02em] text-[#111] sm:text-base sm:tracking-[0.04em]">{entry.displayName}</span>
                        </span>
                        {(picksHidden || !scoringIsLive || entry.obStandIns > 0) && (
                          <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#555]">
                            {picksHidden ? 'Picks hidden until lock' : scoringIsLive ? <span className="text-[#b21e23]">{entry.obStandIns} OB</span> : 'Waiting'}
                          </div>
                        )}
                      </div>
                      <div className={`flex flex-col items-center justify-center text-center text-2xl font-black ${scoreClass(entry.totalScore)}`}>
                        <div>{formatScore(entry.totalScore)}</div>
                        {totalScoreSubLabel && entry.todayScore !== null ? <div className="text-[8px] font-black uppercase tracking-[0.08em] text-[#657168]">{totalScoreSubLabel} {formatScore(entry.todayScore)}</div> : null}
                      </div>
                      <div className="flex items-center justify-center text-[#111]" aria-label={isOpen ? 'Collapse entry' : 'Expand entry'}>
                        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d={isOpen ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'} stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" /></svg>
                      </div>
                    </summary>
                    <div className="grid border-t border-[#111] bg-[#fbfbf5]" style={{ gridTemplateColumns: `repeat(${pickGridColumns}, minmax(0, 1fr))` }}>
                      {Array.from({ length: countScores }, (_, i) => {
                        const pick = countingPicks[i]
                        return (
                          <div key={i} className={`relative border-t border-[#111] px-1 py-1.5 text-center ${((i + 1) % pickGridColumns === 0) ? '' : 'border-r'} ${picksHidden ? 'bg-[#efeee6]' : ''}`}>
                            <>{pick?.isObStandIn ? <ObMarkerCorner /> : <LeverageMarkerCorner kind={pick && hareNames?.has(normalizePickName(pick.name)) ? 'hare' : pick && tortoiseNames?.has(normalizePickName(pick.name)) ? 'tortoise' : undefined} />}</>
                            <div className={`text-lg font-black leading-none ${scoreClass(pick?.scoreToPar ?? null)}`}>{pick ? formatScore(pick.scoreToPar) : '—'}</div>
                            <div className="mt-1 whitespace-nowrap text-[clamp(8px,2.45vw,11px)] font-black uppercase leading-none tracking-[-0.03em] text-[#111] sm:text-xs sm:tracking-[-0.01em]">{pick ? shortName(pick.name, allPickNames) : '—'}</div>
                            <div className="mt-0.5 text-[8px] font-black uppercase tracking-[0.06em] text-[#555]">{pick ? activePoolPickStatusLabel(pick, leaderboardByName, teeTimeZone) : '—'}</div>
                          </div>
                        )
                      })}
                    </div>
                    {outOfBoundsPicks.length > 0 && (
                      <div className="border-t-2 border-[#111] bg-[#efeee6] px-2 py-1.5 text-left">
                        <div className="mb-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#111]">Outside Top {countScores}</div>
                        <div className="flex flex-wrap gap-1">
                          {outOfBoundsPicks.map(pick => (
                            <span key={`${entry.entryId}-${pick.name}`} className="inline-flex items-center gap-1 border border-[#111] bg-[#fbfbf5] px-1.5 py-1 text-[10px] font-black uppercase leading-none text-[#111]">
                              {pick.isObStandIn ? <ObMarker /> : null}
                              {hareNames?.has(normalizePickName(pick.name)) ? <LeverageMarker kind="hare" /> : null}
                              {tortoiseNames?.has(normalizePickName(pick.name)) ? <LeverageMarker kind="tortoise" /> : null}
                              <span className={scoreClass(pick.scoreToPar)}>{formatScore(pick.scoreToPar)}</span> {shortName(pick.name, allPickNames)} <span className="text-[#555]">{activePoolPickStatusLabel(pick, leaderboardByName, teeTimeZone)}</span>
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
              <table className="w-full table-fixed border-separate border-spacing-0 text-[12px] text-[#111]">
                <thead>
                  <tr className="bg-[#f7f7f2] text-[10px] font-black uppercase tracking-[0.12em] text-[#111]">
                    <th className="w-[5%] border-b border-r border-[#111] px-1 py-1.5 text-center">Rank</th>
                    <th className="w-[19%] border-b border-r border-[#111] px-2 py-1.5 text-left">Entry</th>
                    <th className="border-b border-r border-[#111] px-1 py-1.5 text-center" colSpan={countScores}>Top {countScores} golfers</th>
                    <th className="w-[9%] border-b border-[#111] px-1 py-1.5 text-center">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {scoredEntries.map(entry => {
                    const countingPicks = entry.pickScores.filter(pick => pick.counted).slice(0, countScores)
                    const outOfBoundsPicks = entry.pickScores.filter(pick => !pick.counted)
                    const allPickNames = golferNamePeers
                    const isCurrentEntry = entry.entryId === currentEntryId
                    const hareNames = isCurrentEntry ? harePickMap.get(entry.entryId) : undefined
                    const tortoiseNames = !isCurrentEntry ? tortoisePickMap.get(entry.entryId) : undefined
                    return (
                      <Fragment key={entry.entryId}>
                        <tr data-dashboard-entry-id={isCurrentEntry ? entry.entryId : undefined} className="scroll-mt-28">
                          <td className={`border-b border-r border-[#111] px-1 py-1.5 text-center text-xl font-black text-[#b21e23] ${isCurrentEntry ? 'bg-[#fff4cf]' : 'bg-[#f7f7f2]'}`}>{entry.rank || '—'}</td>
                          <td className={`border-b border-r border-[#111] px-2 py-1.5 text-left ${isCurrentEntry ? 'bg-[#fff4cf] shadow-[inset_5px_0_0_#1f6b4a]' : 'bg-[#f7f7f2]'}`}>
                            <span className="flex min-w-0 items-center gap-1.5" title={entry.displayName}>
                              {isCurrentEntry ? <CurrentUserMarker /> : null}
                              <span className="truncate text-base font-black uppercase tracking-[0.02em] text-[#111]">{entry.displayName}</span>
                            </span>
                            {entry.obStandIns > 0 && <div className="mt-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-[#b21e23]">{entry.obStandIns} OB</div>}
                          </td>
                          {Array.from({ length: countScores }, (_, i) => {
                            const pick = countingPicks[i]
                            return (
                              <td key={i} className="relative border-b border-r border-[#111] bg-[#fbfbf5] px-1 py-1 text-center align-middle">
                                <>{pick?.isObStandIn ? <ObMarkerCorner /> : <LeverageMarkerCorner kind={pick && hareNames?.has(normalizePickName(pick.name)) ? 'hare' : pick && tortoiseNames?.has(normalizePickName(pick.name)) ? 'tortoise' : undefined} />}</>
                                <div className={`text-lg font-black leading-none ${scoreClass(pick?.scoreToPar ?? null)}`}>{pick ? formatScore(pick.scoreToPar) : '—'}</div>
                                <div className="mt-0.5 break-words text-[11px] font-black uppercase leading-tight tracking-[-0.01em] text-[#111] xl:text-xs">{pick ? shortName(pick.name, allPickNames) : '—'}</div>
                                <div className="mt-0.5 text-[8px] font-black uppercase tracking-[0.06em] text-[#555]">{pick ? activePoolPickStatusLabel(pick, leaderboardByName, teeTimeZone) : '—'}</div>
                              </td>
                            )
                          })}
                          <td className={`border-b border-[#111] bg-[#fbfbf5] px-1 py-1.5 text-center text-3xl font-black ${scoreClass(entry.totalScore)}`}>
                            <div>{formatScore(entry.totalScore)}</div>
                            {totalScoreSubLabel && entry.todayScore !== null ? <div className="whitespace-nowrap text-[9px] font-black uppercase tracking-[0.08em] text-[#657168]">{totalScoreSubLabel} {formatScore(entry.todayScore)}</div> : null}
                          </td>
                        </tr>
                        {outOfBoundsPicks.length > 0 && (
                          <tr className="bg-[#efeee6]">
                            <td className="border-b border-r border-[#111] bg-[#efeee6]" />
                            <td className="border-b border-r border-[#111] bg-[#efeee6] px-2 py-1 text-left text-[9px] font-black uppercase tracking-[0.1em] text-[#111]">Outside Top {countScores}</td>
                            <td className="border-b border-[#111] bg-[#efeee6] px-2 py-1 text-left" colSpan={countScores + 1}>
                              <div className="flex flex-wrap gap-1">
                                {outOfBoundsPicks.map(pick => (
                                  <span key={`${entry.entryId}-${pick.name}`} className="inline-flex items-center gap-1 border border-[#111] bg-[#fbfbf5] px-1.5 py-1 text-[10px] font-black uppercase leading-none text-[#111]">
                                    {pick.isObStandIn ? <ObMarker /> : null}
                                    {hareNames?.has(normalizePickName(pick.name)) ? <LeverageMarker kind="hare" /> : null}
                                    {tortoiseNames?.has(normalizePickName(pick.name)) ? <LeverageMarker kind="tortoise" /> : null}
                                    <span><span className={scoreClass(pick.scoreToPar)}>{formatScore(pick.scoreToPar)}</span> {shortName(pick.name, allPickNames)} <span className="text-[#555]">{activePoolPickStatusLabel(pick, leaderboardByName, teeTimeZone)}</span></span>
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
          {showLeverageLegend ? <LeverageMarkerLegend showTortoise={tortoisePickMap.size > 0} className="mt-1" /> : null}
        </div>
      </div>
      <div className="gpp-board-post mx-auto -mt-[4px] h-20 w-14 [--gpp-depth-x:10px] [--gpp-depth-y:8px] md:-mt-[6px] md:h-28 md:w-16 md:[--gpp-depth-x:18px] md:[--gpp-depth-y:12px]">
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
  return {
    rank: current.rank,
    totalScore: current.totalScore,
    todayScore: current.todayScore,
    movementToday: priorEntries.length > 0 ? entryMovementSincePriorRank(current, priorEntries) : null,
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
      <span className="inline-flex items-center gap-1 whitespace-nowrap border border-[#1f6b4a] bg-[#eef7ef] px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#1f6b4a]">
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square"><path d="M2 6l3 3 5-5" /></svg>
        {count}/{needed} picks
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap border border-[#b58a3a] bg-[#fff4cf] px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#7a5a19]">
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
    <span className="whitespace-nowrap border border-[#f0c8c3] bg-[#fff1ef] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.06em] text-[#b21e23] sm:px-2 sm:py-1 sm:text-[10px]">
      Lock {formatted} ET
    </span>
  )
}

export default function DashboardActivePools({ cards, entriesByPool, mode = 'player', snapshot = false }: { cards: ActivePoolCard[]; entriesByPool: Record<string, EntryRecord[]>; mode?: 'player' | 'runner'; snapshot?: boolean }) {
  const router = useRouter()
  const [expandedPoolIds, setExpandedPoolIds] = useState<Set<string>>(() => new Set(cards[0]?.pool.id ? [cards[0].pool.id] : []))
  const [expandedEntryIds, setExpandedEntryIds] = useState<Record<string, Set<string>>>(() => ({}))
  const [liveLeaderboardsByExternalId, setLiveLeaderboardsByExternalId] = useState<Record<string, LiveTournamentPayload>>({})
  const [teeTimeZone, setTeeTimeZone] = useState(DEFAULT_TEE_TIME_ZONE)
  const [poolOrder, setPoolOrder] = useState<string[]>(() => cards.map(card => card.pool.id))
  const [poolOrderHydrated, setPoolOrderHydrated] = useState(false)
  const [sortMode, setSortMode] = useState(false)

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

  const activeExternalIds = useMemo(() => Array.from(new Set(
    cards
      .filter(card => hasEventBegun(card.tournament))
      .map(card => card.tournament?.external_id)
      .filter((externalId): externalId is string => Boolean(externalId))
  )), [cards])

  useEffect(() => {
    if (snapshot || activeExternalIds.length === 0) return
    let cancelled = false

    async function fetchLiveLeaderboards() {
      const nextEntries = await Promise.all(activeExternalIds.map(async externalId => {
        try {
          const res = await fetch(`/api/tournaments/leaderboard?id=${encodeURIComponent(externalId)}`, { cache: 'no-store' })
          if (!res.ok) return [externalId, null] as const
          const data = await res.json()
          return [externalId, { leaderboard: data.leaderboard || null, cutLine: data.cutLine || null }] as const
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

    fetchLiveLeaderboards()
    const intervalId = window.setInterval(fetchLiveLeaderboards, 30000)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [activeExternalIds, snapshot])

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (detected) setTeeTimeZone(detected)
  }, [])

  useEffect(() => {
    if (snapshot) return
    const refreshId = window.setInterval(() => {
      router.refresh()
    }, 30000)

    return () => window.clearInterval(refreshId)
  }, [router, snapshot])

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
    if (!poolOrderHydrated || !savedTopPoolId) return

    setExpandedPoolIds(current => {
      if (current.size === 0) return new Set([savedTopPoolId])
      if (defaultTopPoolId && current.size === 1 && current.has(defaultTopPoolId)) return new Set([savedTopPoolId])
      return current
    })
  }, [defaultTopPoolId, orderedPoolIds, poolOrderHydrated])

  useEffect(() => {
    if (!poolOrderHydrated) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(orderedPoolIds))
    } catch {
      // Reordering is a convenience. Do not block the dashboard if storage is unavailable.
    }
  }, [orderedPoolIds, poolOrderHydrated, storageKey])

  useEffect(() => {
    if (snapshot || mode !== 'player' || cards.length === 0) return
    try {
      window.localStorage.setItem(`${DASHBOARD_ACTIVE_POOLS_CACHE_KEY}:${mode}`, JSON.stringify({
        version: DASHBOARD_ACTIVE_POOLS_CACHE_VERSION,
        cachedAt: Date.now(),
        cards,
        entriesByPool,
      }))
    } catch {
      // Snapshot restore is best-effort. The live dashboard still works without local storage.
    }
  }, [cards, entriesByPool, mode, snapshot])

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
    <section className={useSinglePoolMobileLayout ? 'border-0 bg-transparent shadow-none sm:border-2 sm:border-[#123c2f] sm:bg-white sm:shadow-[7px_7px_0_#d8cab0]' : 'border-2 border-[#123c2f] bg-white shadow-[7px_7px_0_#d8cab0]'}>
      <div className={`${useSinglePoolMobileLayout ? 'hidden sm:flex' : 'flex'} items-center justify-between gap-3 border-b border-[#d8cab0] bg-[#123c2f] px-3 py-2 text-white sm:px-5 sm:py-3`}>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#d7c99f] sm:text-xs sm:tracking-[0.22em]">Active pools</h2>
        <div className="flex items-center gap-2">
          {canSortPools ? (
            <button
              type="button"
              onClick={() => {
                setSortMode(current => !current)
              }}
              className={`border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${sortMode ? 'border-white bg-white text-[#123c2f]' : 'border-[#d7c99f] text-[#f3df9c]'}`}
              aria-pressed={sortMode}
            >
              {sortMode ? 'Done' : 'Sort'}
            </button>
          ) : null}
        </div>
      </div>
      <div className={useSinglePoolMobileLayout ? 'sm:divide-y sm:divide-[#eadfca]' : 'divide-y divide-[#eadfca]'}>
        {orderedCards.map(({ pool, tournament, role, entry }, index) => {
          const livePayload = tournament?.external_id ? liveLeaderboardsByExternalId[tournament.external_id] : null
          const effectiveTournament = tournament && livePayload?.leaderboard?.length
            ? { ...tournament, leaderboard_json: livePayload.leaderboard, cutLine: livePayload.cutLine ?? tournament.cutLine ?? null }
            : tournament
          const effectivePool = effectiveTournament ? { ...pool, gpp_tournaments: effectiveTournament } : pool
          const label = statusLabel(effectivePool, effectiveTournament)
          const poolEntries = entriesByPool[pool.id] || (entry ? [entry] : [])
          const rankPreview = entry ? buildRankPreview(entry, effectivePool, poolEntries) : null
          const isPoolOpen = useSinglePoolMobileLayout || expandedPoolIds.has(pool.id)
          const openEntryIds = expandedEntryIds[pool.id] ?? null
          const eventBegun = hasEventBegun(effectiveTournament)
          const tournamentDisplayName = displayTournamentName(effectiveTournament?.name) || 'Tournament'
          const canReorderPools = canSortPools && sortMode
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
              className={`${useSinglePoolMobileLayout ? 'bg-transparent sm:bg-white' : index % 2 === 0 ? 'bg-white' : 'bg-[#fbf7ed]'} group`}
            >
              <summary className={`${useSinglePoolMobileLayout ? 'hidden sm:block' : 'block'} cursor-pointer list-none px-2.5 py-2 transition-colors hover:bg-[#fff8e8] sm:px-5 sm:py-3 [&::-webkit-details-marker]:hidden`}>
                <div className="grid min-h-10 min-w-0 grid-cols-[32px_minmax(0,1fr)_64px_96px] items-center gap-1.5 sm:min-h-11 sm:grid-cols-[40px_minmax(0,1fr)_86px_132px] sm:gap-3">
                  <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center border border-[#123c2f] ${isPoolOpen ? 'bg-[#123c2f] text-white' : 'bg-white text-[#123c2f]'} sm:h-9 sm:w-9`} aria-label={isPoolOpen ? 'Collapse pool' : 'Expand pool'}>
                    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d={isPoolOpen ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'} stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" /></svg>
                  </span>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <p className="min-w-0 truncate pb-0.5 text-base font-black leading-tight text-[#0f2f25] sm:text-lg">{pool.name}</p>
                    {canReorderPools ? (
                      <span className="inline-flex shrink-0 flex-col border border-[#123c2f] bg-white text-[#123c2f]">
                        <button
                          type="button"
                          onClick={event => {
                            event.preventDefault()
                            event.stopPropagation()
                            const previousPoolId = orderedCards[index - 1]?.pool.id
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
                            const nextPoolId = orderedCards[index + 1]?.pool.id
                            if (nextPoolId) reorderPool(nextPoolId, pool.id)
                          }}
                          disabled={index === orderedCards.length - 1}
                          className="flex h-4 w-5 items-center justify-center disabled:cursor-not-allowed disabled:text-[#b7bdb6] disabled:opacity-50"
                          aria-label={`Move ${pool.name} down`}
                          title="Move down"
                        >
                          <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" /></svg>
                        </button>
                      </span>
                    ) : null}
                  </div>
                  <div className="flex min-w-0 justify-center">
                    {hasRecentScores(effectiveTournament) ? <LivePulseBadge /> : label !== 'Open' ? <StatusBadge label={label} locked={Boolean(pool.is_locked)} /> : null}
                  </div>
                  {eventBegun ? (
                    <div className="flex min-h-10 w-full shrink-0 flex-col items-center justify-center border border-[#123c2f] bg-white px-1 py-1 text-[12px] font-black uppercase leading-none text-[#111] shadow-[1px_1px_0_#d8cab0] sm:min-h-11 sm:px-2 sm:text-base sm:shadow-[2px_2px_0_#d8cab0]">
                      <div className="flex items-center gap-1 sm:gap-2">
                        {rankPreview?.rank ? <span className="text-[#123c2f]">#{rankPreview.rank}</span> : <span className="text-[#657168]">—</span>}
                        <span className="text-[#657168]">/</span>
                        <span className={scoreClass(rankPreview?.totalScore ?? null)}>{formatScore(rankPreview?.totalScore ?? null)}</span>
                      </div>
                      {!isPoolOpen && (typeof rankPreview?.todayScore === 'number' || rankPreview?.movementToday) ? (
                        <div className="mt-1 flex items-center gap-1 text-[8px] font-black leading-none text-[#657168] sm:text-[10px]">
                          {typeof rankPreview?.todayScore === 'number' ? <span>Today <span className={scoreClass(rankPreview.todayScore)}>{formatScore(rankPreview.todayScore)}</span></span> : null}
                          {typeof rankPreview?.todayScore === 'number' && rankPreview?.movementToday ? <span>/</span> : null}
                          {rankPreview?.movementToday ? <MovementArrow movement={rankPreview.movementToday} /> : null}
                        </div>
                      ) : null}
                    </div>
                  ) : <div />}
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
                    teeTimeZone={teeTimeZone}
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
