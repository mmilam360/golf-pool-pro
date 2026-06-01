'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { availableCompletedRounds, buildHarePickMap, buildTortoisePickMap, leaderboardForCompletedRound, leaderboardForRoundOnly, normalizePickName, rankEntries, scoreEntry, type PickScore, type ScoredEntry } from '@/lib/scoring'
import { LeverageMarker, LeverageMarkerCorner, LeverageMarkerLegend, ObMarker, ObMarkerCorner } from '@/components/LeverageMarkers'
import { hasOnCourseScores } from '@/lib/golf-live'
import { formatDateOnly } from '@/lib/date-utils'
import { leaderboardBackedPickProgressLabel } from '@/lib/golfer-status'
import { TournamentLeaderboard } from '@/components/TournamentLeaderboard'
import type { GolfCutLine, GolfPlayer } from '@/lib/golf-api'

type Tournament = {
  name?: string | null
  external_id?: string | null
  start_date?: string | null
  end_date?: string | null
  status?: string | null
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
  fieldSize: number
}

const DEFAULT_TEE_TIME_ZONE = 'America/New_York'
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
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap border px-2 py-1 text-xs font-bold uppercase tracking-[0.12em] ${statusClass(label)}`}>
      {label === 'Passed' ? null : <LockGlyph locked={locked || label === 'Live'} />}
      {label}
    </span>
  )
}

function LivePulseBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 border border-[#b21e23] bg-[#fff1ef] px-2 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[#b21e23]">
      <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping bg-[#b21e23] opacity-70" />
        <span className="relative inline-flex h-2.5 w-2.5 bg-[#b21e23]" />
      </span>
      Live
    </span>
  )
}

function scoreBadgeClass(score: number | null | undefined) {
  if (typeof score === 'number' && score < 0) return 'border-[#b21e23] bg-[#fff1ef] text-[#b21e23]'
  return 'border-[#d8cab0] bg-white text-[#111]'
}

function ScoreBadge({ score }: { score: number | null | undefined }) {
  const text = typeof score === 'number' ? formatScore(score) : '—'
  return (
    <span className={`whitespace-nowrap border px-2 py-1 font-black ${scoreBadgeClass(score)}`}>
      Score {text}
    </span>
  )
}

function DateIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" strokeLinejoin="miter">
      <path d="M7 3v4M17 3v4M4 9h16" />
      <rect x="4" y="5" width="16" height="16" />
      <path d="M8 13h2M12 13h2M16 13h2M8 17h2M12 17h2" />
    </svg>
  )
}

function StartDateBadge({ date }: { date?: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap border border-[#b58a3a] bg-[#fff4cf] px-2 py-1 font-black text-[#7a5a19]">
      <DateIcon />
      Starts {formatEventDate(date)}
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
  return tournament?.name || 'Leaderboard'
}

function formatEventDate(value?: string | null) {
  return formatDateOnly(value, { month: 'short', day: 'numeric', year: 'numeric' })
}

function poolIsOpenForPicks(pool: PoolRecord, tournament: Tournament | null) {
  return !pool.is_locked && !pool.is_completed && tournament?.status !== 'live' && tournament?.status !== 'completed'
}

function OpenPicksBar({ pool, tournament }: { pool: PoolRecord; tournament: Tournament | null }) {
  if (!poolIsOpenForPicks(pool, tournament)) return null
  return (
    <div className="mb-3 flex flex-col gap-2 border border-[#d8cab0] bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-[#123c2f] sm:flex-row sm:items-center sm:justify-between">
      <span className="text-[#657168]">Event starts: <span className="text-[#123c2f]">{formatEventDate(tournament?.start_date)}</span></span>
      <a href={`/pool/${pool.id}#make-picks`} className="inline-flex w-fit border border-[#123c2f] bg-[#fbf7ed] px-3 py-1.5 text-[#123c2f] hover:bg-[#fff4cf]">
        Edit picks
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

function InlineLeaderboard({ pool, entries, currentEntryId, openEntryIds, onEntryToggle, teeTimeZone }: {
  pool: PoolRecord
  entries: EntryRecord[]
  currentEntryId?: string | null
  openEntryIds: Set<string> | null
  onEntryToggle: (entryId: string, open: boolean) => void
  teeTimeZone: string
}) {
  const countScores = pool.count_scores || 4
  const tournament = Array.isArray(pool.gpp_tournaments) ? pool.gpp_tournaments[0] ?? null : pool.gpp_tournaments ?? null
  const baseLeaderboardRows = Array.isArray(tournament?.leaderboard_json) ? tournament.leaderboard_json : []
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
    ? 'TODAY'
    : leaderboardMode.type === 'thru' && leaderboardMode.round > 1
      ? roundScoreLabel(leaderboardMode.round)
      : null
  const scoringIsLive = Boolean(pool.is_locked || tournament?.status === 'live' || tournament?.status === 'completed' || hasOnCourseScores(leaderboardRows))
  const scoredEntries = scoringIsLive
    ? buildScoredEntries(pool, entries, leaderboardRows, selectedBoardIsHistorical)
    : entries.map(entry => buildPreScoringEntry(entry, countScores, entry.id !== currentEntryId))
  const pickGridColumns = pickGridColumnCount(countScores)
  const leaderboardByName = new Map(leaderboardRows.map(player => [normalizePickName(player.name || `${player.firstName || ''} ${player.lastName || ''}`.trim()), player]))
  const golferNamePeers = leaderboardRows
    .map(player => player.name || `${player.firstName || ''} ${player.lastName || ''}`.trim())
    .filter(Boolean)
  const currentScoredEntry = currentEntryId ? scoredEntries.find(entry => entry.entryId === currentEntryId) : null
  const harePickMap = leaderboardModeIsCurrent ? buildHarePickMap(scoredEntries, 2) : new Map()
  const tortoisePickMap = leaderboardModeIsCurrent ? buildTortoisePickMap(scoredEntries, currentEntryId, 2) : new Map()
  const showLeverageLegend = leaderboardModeIsCurrent && (harePickMap.size > 0 || tortoisePickMap.size > 0)
  const showJumpToMyEntry = Boolean(currentScoredEntry && scoredEntries.length >= 10)
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
        <OpenPicksBar pool={pool} tournament={tournament} />
      </div>
    )
  }

  return (
    <div className="overflow-hidden border-t border-[#eadfca] bg-[#fbf7ed] px-2 pb-0 pt-4 sm:px-5">
      <OpenPicksBar pool={pool} tournament={tournament} />
      {showJumpToMyEntry ? (
        <div className="mb-3 flex justify-center">
          <button type="button" onClick={jumpToCurrentEntry} className="border-2 border-[#123c2f] bg-white px-4 py-2 text-center text-xs font-black uppercase tracking-[0.12em] text-[#123c2f] shadow-[3px_3px_0_#d8cab0] hover:bg-[#fffdf8]">
            Jump to my entry
          </button>
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
              <p className="mx-auto max-w-[92%] truncate text-xl font-black uppercase leading-none tracking-[0.1em] text-[#111] sm:text-2xl sm:tracking-[0.16em]" title={boardTitle(tournament)}>{boardTitle(tournament)}</p>
              <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.12em] text-[#005b3c] sm:text-xs">{pool.name}</p>
              {availableHistoricalRounds.length > 0 && (
                <details
                  className="relative z-50 mx-auto mt-2 w-fit text-left"
                  open={leaderboardMenuOpen}
                  onToggle={event => setLeaderboardMenuOpen(event.currentTarget.open)}
                >
                  <summary className="list-none border-2 border-[#123c2f] bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#123c2f] shadow-[2px_2px_0_#d8cab0] marker:hidden [&::-webkit-details-marker]:hidden">
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
                return (
                  <details data-dashboard-entry-id={isCurrentEntry ? entry.entryId : undefined} id={isCurrentEntry ? `dashboard-entry-${entry.entryId}` : undefined} key={entry.entryId} open={isOpen} onToggle={event => onEntryToggle(entry.entryId, event.currentTarget.open)} className="scroll-mt-28 group border-b-2 border-[#111] last:border-b-0">
                    <summary className="grid min-h-[58px] cursor-pointer list-none grid-cols-[34px_minmax(0,1fr)_58px_18px] items-center gap-1 bg-[#f7f7f2] px-2 py-2 text-left transition-colors hover:bg-[#fffdf4] group-open:bg-[#fffdf4] sm:grid-cols-[44px_minmax(0,1fr)_74px_20px] sm:gap-2 [&::-webkit-details-marker]:hidden">
                      <div className="text-center text-xl font-black text-[#b21e23]">{entry.rank || '—'}</div>
                      <div className="min-w-0">
                        <span className="flex min-w-0 items-center gap-1.5">
                          {isCurrentEntry ? <CurrentUserMarker /> : null}
                          <span className="min-w-0 flex-1 break-words text-sm font-black uppercase leading-tight tracking-[0.02em] text-[#111] sm:text-base sm:tracking-[0.04em]">{entry.displayName}</span>
                        </span>
                        {entry.obStandIns > 0 && <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#b21e23]">{entry.obStandIns} OB</div>}
                      </div>
                      <div className={`text-right text-2xl font-black ${scoreClass(entry.totalScore)}`}>
                        <div>{formatScore(entry.totalScore)}</div>
                        {totalScoreSubLabel && entry.todayScore !== null ? <div className="text-[8px] font-black uppercase tracking-[0.08em] text-[#657168]">{totalScoreSubLabel}: {formatScore(entry.todayScore)}</div> : null}
                      </div>
                      <div className="flex items-center justify-center text-[#111]" aria-label={isOpen ? 'Collapse entry' : 'Expand entry'}>
                        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d={isOpen ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'} stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" /></svg>
                      </div>
                    </summary>
                    <div className="grid border-t border-[#111] bg-[#fbfbf5]" style={{ gridTemplateColumns: `repeat(${pickGridColumns}, minmax(0, 1fr))` }}>
                      {Array.from({ length: countScores }, (_, i) => {
                        const pick = countingPicks[i]
                        const picksHidden = entry.picks.includes('__hidden__')
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
              <table className="w-full table-fixed border-collapse text-[12px] text-[#111]">
                <thead>
                  <tr className="bg-[#f7f7f2] text-[10px] font-black uppercase tracking-[0.12em] text-[#111]">
                    <th className="w-[5%] border-b-2 border-r-2 border-[#111] bg-[#f7f7f2] px-1 py-1.5 text-center">Rank</th>
                    <th className="w-[19%] border-b-2 border-r-2 border-[#111] bg-[#f7f7f2] px-2 py-1.5 text-left">Entry</th>
                    <th className="border-b-2 border-r-2 border-[#111] px-1 py-1.5 text-center" colSpan={countScores}>Top {countScores} golfers</th>
                    <th className="w-[9%] border-b-2 border-[#111] px-1 py-1.5 text-center">Total</th>
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
                        <tr data-dashboard-entry-id={isCurrentEntry ? entry.entryId : undefined} className="scroll-mt-28 bg-[#f7f7f2]">
                          <td className="border-b border-r-2 border-[#111] bg-[#f7f7f2] px-1 py-1.5 text-center text-xl font-black text-[#b21e23]">{entry.rank || '—'}</td>
                          <td className="border-b border-r-2 border-[#111] bg-[#f7f7f2] px-2 py-1.5 text-left">
                            <span className="flex min-w-0 items-center gap-1.5" title={entry.displayName}>
                              {isCurrentEntry ? <CurrentUserMarker /> : null}
                              <span className="truncate text-base font-black uppercase tracking-[0.02em] text-[#111]">{entry.displayName}</span>
                            </span>
                            {entry.obStandIns > 0 && <div className="mt-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-[#b21e23]">{entry.obStandIns} OB</div>}
                          </td>
                          {Array.from({ length: countScores }, (_, i) => {
                            const pick = countingPicks[i]
                            return (
                              <td key={i} className="relative border-b border-r border-[#111] bg-[#fbfbf5] px-1 py-1 text-center align-middle shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
                                <>{pick?.isObStandIn ? <ObMarkerCorner /> : <LeverageMarkerCorner kind={pick && hareNames?.has(normalizePickName(pick.name)) ? 'hare' : pick && tortoiseNames?.has(normalizePickName(pick.name)) ? 'tortoise' : undefined} />}</>
                                <div className={`text-lg font-black leading-none ${scoreClass(pick?.scoreToPar ?? null)}`}>{pick ? formatScore(pick.scoreToPar) : '—'}</div>
                                <div className="mt-0.5 break-words text-[11px] font-black uppercase leading-tight tracking-[-0.01em] text-[#111] xl:text-xs">{pick ? shortName(pick.name, allPickNames) : '—'}</div>
                                <div className="mt-0.5 text-[8px] font-black uppercase tracking-[0.06em] text-[#555]">{pick ? activePoolPickStatusLabel(pick, leaderboardByName, teeTimeZone) : '—'}</div>
                              </td>
                            )
                          })}
                          <td className={`border-b border-[#111] bg-[#fbfbf5] px-1 py-1.5 text-center text-3xl font-black ${scoreClass(entry.totalScore)}`}>
                            <div>{formatScore(entry.totalScore)}</div>
                            {totalScoreSubLabel && entry.todayScore !== null ? <div className="whitespace-nowrap text-[9px] font-black uppercase tracking-[0.08em] text-[#657168]">{totalScoreSubLabel}: {formatScore(entry.todayScore)}</div> : null}
                          </td>
                        </tr>
                        {outOfBoundsPicks.length > 0 && (
                          <tr className="bg-[#efeee6]">
                            <td className="border-b border-r-2 border-[#111] bg-[#efeee6]" />
                            <td className="border-b border-r-2 border-[#111] bg-[#efeee6] px-2 py-1 text-left text-[9px] font-black uppercase tracking-[0.1em] text-[#111]">Outside Top {countScores}</td>
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
  return { rank: current.rank, totalScore: current.totalScore, fieldSize: scored.length }
}

function entryPicks(entry?: EntryRecord | null) {
  return Array.isArray(entry?.golfer_picks) ? entry.golfer_picks as string[] : []
}

function totalPicksNeeded(pool: PoolRecord): number {
  if (pool.game_format === 'grouped' && pool.pick_groups_json && typeof pool.pick_groups_json === 'object') {
    const groups = Array.isArray(pool.pick_groups_json) ? pool.pick_groups_json : (pool.pick_groups_json as Record<string, unknown>)?.groups
    if (Array.isArray(groups)) return groups.reduce((sum: number, g: unknown) => sum + (typeof g === 'object' && g !== null ? ((g as Record<string, unknown>).picks_per_group as number || 1) : 1), 0)
  }
  if (pool.game_format === 'random_groups' || pool.game_format === 'ranked_groups') {
    return pool.picks_per_group ? pool.picks_per_group * (pool.group_count || 6) : pool.count_scores || 12
  }
  return pool.count_scores || 4
}

function canShowPickBadge(pool: PoolRecord, tournament: Tournament | null) {
  // Once tournament starts, hide pick badge entirely
  if (tournament?.status === 'live' || tournament?.status === 'completed') return false
  if (pool.is_locked || pool.is_completed) return false
  // For grouped pools, only show after groups are locked
  const isGrouped = pool.game_format === 'random_groups' || pool.game_format === 'ranked_groups'
  if (isGrouped) return Boolean(pool.groups_finalized_at)
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

function LockTimeBadge({ pool }: { pool: PoolRecord }) {
  const lockTime = pool.lock_at || pool.groups_finalized_at
  const formatted = formatLockTime(lockTime)
  if (!formatted) return null
  return (
    <span className="whitespace-nowrap text-[10px] font-black uppercase tracking-[0.08em] text-[#b21e23] text-right">
      Picks Lock:<br />{formatted} ET
    </span>
  )
}

function isWithinTwoDaysOfStart(startDate?: string | null) {
  if (!startDate) return false
  const start = new Date(startDate + 'T00:00:00')
  const now = new Date()
  const diffMs = start.getTime() - now.getTime()
  return diffMs > 0 && diffMs <= 2 * 24 * 60 * 60 * 1000
}

function formatLockTime(value?: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return null
  return parsed.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
  }).toLowerCase().replace(',', '')
}

export default function DashboardActivePools({ cards, entriesByPool }: { cards: ActivePoolCard[]; entriesByPool: Record<string, EntryRecord[]> }) {
  const router = useRouter()
  const [expandedPoolIds, setExpandedPoolIds] = useState<Set<string>>(() => new Set())
  const [expandedEntryIds, setExpandedEntryIds] = useState<Record<string, Set<string>>>(() => ({}))
  const [liveLeaderboardsByExternalId, setLiveLeaderboardsByExternalId] = useState<Record<string, LiveTournamentPayload>>({})
  const [secondsToRefresh, setSecondsToRefresh] = useState(60)
  const [teeTimeZone, setTeeTimeZone] = useState(DEFAULT_TEE_TIME_ZONE)

  const activeExternalIds = useMemo(() => Array.from(new Set(cards.map(card => card.tournament?.external_id).filter(Boolean) as string[])), [cards])

  useEffect(() => {
    if (activeExternalIds.length === 0) return
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
    const intervalId = window.setInterval(fetchLiveLeaderboards, 60000)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [activeExternalIds])

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (detected) setTeeTimeZone(detected)
  }, [])

  useEffect(() => {
    const countdownId = window.setInterval(() => {
      setSecondsToRefresh(seconds => {
        if (seconds <= 1) {
          router.refresh()
          return 60
        }
        return seconds - 1
      })
    }, 1000)

    return () => window.clearInterval(countdownId)
  }, [router])

  const activePoolIds = useMemo(() => new Set(cards.map(card => card.pool.id)), [cards])

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

  if (cards.length === 0) return null

  return (
    <section className="border-2 border-[#123c2f] bg-white shadow-[7px_7px_0_#d8cab0]">
      <div className="flex items-center justify-between gap-3 border-b border-[#d8cab0] bg-[#123c2f] px-4 py-3 text-white sm:px-5">
        <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-[#d7c99f]">Active pools</h2>
        <span className="border border-[#d7c99f] px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#f3df9c]">Refresh {secondsToRefresh}s</span>
      </div>
      <div className="divide-y divide-[#eadfca]">
        {cards.map(({ pool, tournament, role, entry }, index) => {
          const livePayload = tournament?.external_id ? liveLeaderboardsByExternalId[tournament.external_id] : null
          const effectiveTournament = tournament && livePayload?.leaderboard?.length
            ? { ...tournament, leaderboard_json: livePayload.leaderboard, cutLine: livePayload.cutLine ?? tournament.cutLine ?? null }
            : tournament
          const effectivePool = effectiveTournament ? { ...pool, gpp_tournaments: effectiveTournament } : pool
          const label = statusLabel(effectivePool, effectiveTournament)
          const poolEntries = entriesByPool[pool.id] || (entry ? [entry] : [])
          const rankPreview = entry ? buildRankPreview(entry, effectivePool, poolEntries) : null
          const isPoolOpen = expandedPoolIds.has(pool.id)
          const openEntryIds = expandedEntryIds[pool.id] ?? null
          const eventBegun = hasEventBegun(effectiveTournament)
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
              className={`group ${index % 2 === 0 ? 'bg-white' : 'bg-[#fbf7ed]'}`}
            >
              <summary className="block cursor-pointer list-none px-4 py-3 transition-colors hover:bg-[#fff8e8] sm:px-5 [&::-webkit-details-marker]:hidden">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-base font-black leading-5 text-[#0f2f25] sm:text-lg">{pool.name}</p>
                     <p className="mt-1 flex items-center gap-1.5 break-words text-sm font-semibold leading-5 text-[#1f2a24]">
                       <img
                         src="/flag-icon.png"
                         alt=""
                         className="h-4 w-4 shrink-0 opacity-80"
                         loading="lazy"
                       />
                       {effectiveTournament?.name || 'Tournament'}
                     </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {hasRecentScores(effectiveTournament) ? <LivePulseBadge /> : label !== 'Open' ? <StatusBadge label={label} locked={Boolean(pool.is_locked)} /> : null}
                    {!pool.is_locked && !pool.is_completed && !eventBegun ? <LockTimeBadge pool={pool} /> : null}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#657168]">
                  <span className={`mr-auto inline-flex items-center border border-[#123c2f] px-2 py-1 ${isPoolOpen ? 'bg-[#123c2f] text-white' : 'bg-white text-[#123c2f]'}`} aria-label={isPoolOpen ? 'Collapse pool' : 'Expand pool'}>
                    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d={isPoolOpen ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'} stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" /></svg>
                  </span>
                  {rankPreview?.rank ? <span className="whitespace-nowrap border border-[#b58a3a] bg-[#fff4cf] px-2 py-1 text-[#7a5a19]">Rank #{rankPreview.rank}</span> : null}
                  {entry ? <PickProgressBadge entry={entry} pool={pool} tournament={effectiveTournament} /> : null}
                  {eventBegun ? <ScoreBadge score={rankPreview?.totalScore} /> : null}
                </div>
              </summary>
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
                teeTimeZone={teeTimeZone}
              />
              <div className="border-t border-[#eadfca] bg-[#fbf7ed] px-3 py-3 sm:px-5 sm:py-4">
                <TournamentLeaderboard
                  leaderboard={effectiveTournament?.leaderboard_json}
                  tournamentName={effectiveTournament?.name}
                  lastUpdated={effectiveTournament?.last_scores_fetch}
                  pickedGolfers={entryPicks(entry)}
                  cutLine={effectiveTournament?.cutLine}
                />
              </div>
            </details>
          )
        })}
      </div>
    </section>
  )
}
