'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { rankEntries, scoreEntry, type ScoredEntry } from '@/lib/scoring'
import { hasOnCourseScores } from '@/lib/golf-live'
import { formatDateOnly } from '@/lib/date-utils'
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

type RankPreview = {
  rank: number | null
  totalScore: number | null
  fieldSize: number
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

function ScoreBadge({ score }: { score: number | null | undefined }) {
  const text = typeof score === 'number' ? formatScore(score) : '—'
  return (
    <span className="whitespace-nowrap border border-[#b21e23] bg-[#fff1ef] px-2 py-1 font-black text-[#b21e23]">
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

function thruLabel(thru?: string) {
  if (!thru) return '—'
  const value = String(thru).toUpperCase()
  return value === 'F' ? 'F' : `THRU ${value}`
}

function buildScoredEntries(pool: PoolRecord, allEntries: EntryRecord[]): ScoredEntry[] {
  const tournament = Array.isArray(pool.gpp_tournaments) ? pool.gpp_tournaments[0] ?? null : pool.gpp_tournaments ?? null
  const leaderboard = Array.isArray(tournament?.leaderboard_json) ? tournament.leaderboard_json : []
  const canShowRank = Boolean(pool.is_locked || tournament?.status === 'live' || tournament?.status === 'completed')

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

function CurrentUserMarker({ className = '' }: { className?: string }) {
  return <span aria-label="Your entry" title="Your entry" className={`inline-block h-2.5 w-2.5 shrink-0 bg-[#1f6b4a] ${className}`} />
}

function InlineLeaderboard({ pool, entries, currentEntryId, openEntryIds, onEntryToggle }: {
  pool: PoolRecord
  entries: EntryRecord[]
  currentEntryId?: string | null
  openEntryIds: Set<string> | null
  onEntryToggle: (entryId: string, open: boolean) => void
}) {
  const scoredEntries = buildScoredEntries(pool, entries)
  const countScores = pool.count_scores || 4
  const tournament = Array.isArray(pool.gpp_tournaments) ? pool.gpp_tournaments[0] ?? null : pool.gpp_tournaments ?? null
  const golferNamePeers = (Array.isArray(tournament?.leaderboard_json) ? tournament.leaderboard_json : [])
    .map(player => player.name || `${player.firstName || ''} ${player.lastName || ''}`.trim())
    .filter(Boolean)
  const currentScoredEntry = currentEntryId ? scoredEntries.find(entry => entry.entryId === currentEntryId) : null
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
        <div className="text-sm font-semibold text-[#657168]">
          The full leaderboard board appears here once scoring is live.
        </div>
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
            <div className="border-b-2 border-[#111] px-3 py-2">
              <p className="mx-auto max-w-[92%] truncate text-xl font-black uppercase leading-none tracking-[0.1em] text-[#111] sm:text-2xl sm:tracking-[0.16em]" title={boardTitle(tournament)}>{boardTitle(tournament)}</p>
              <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.12em] text-[#005b3c] sm:text-xs">{pool.name}</p>
            </div>
            <div className="bg-[#f7f7f2] lg:hidden">
              {scoredEntries.map((entry, entryIndex) => {
                const countingPicks = entry.pickScores.filter(pick => pick.counted).slice(0, countScores)
                const outOfBoundsPicks = entry.pickScores.filter(pick => !pick.counted)
                const allPickNames = golferNamePeers
                const isCurrentEntry = entry.entryId === currentEntryId
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
                      <div className={`text-right text-2xl font-black ${scoreClass(entry.totalScore)}`}>{formatScore(entry.totalScore)}</div>
                      <div className="flex items-center justify-center text-[#111]">
                        <svg className="h-4 w-4 group-open:hidden" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" /></svg>
                        <svg className="hidden h-4 w-4 group-open:block" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 10l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" /></svg>
                      </div>
                    </summary>
                    <div className="grid grid-cols-4 border-t border-[#111] bg-[#fbfbf5]">
                      {Array.from({ length: countScores }, (_, i) => {
                        const pick = countingPicks[i]
                        return (
                          <div key={i} className="border-r border-t border-[#111] px-1 py-1.5 text-center [&:nth-child(4n)]:border-r-0">
                            <div className={`text-lg font-black leading-none ${scoreClass(pick?.scoreToPar ?? null)}`}>{pick ? formatScore(pick.scoreToPar) : '—'}</div>
                            <div className="mt-1 whitespace-nowrap text-[clamp(8px,2.45vw,11px)] font-black uppercase leading-none tracking-[-0.03em] text-[#111] sm:text-xs sm:tracking-[-0.01em]">{pick ? shortName(pick.name, allPickNames) : '—'}</div>
                            <div className="mt-0.5 text-[8px] font-black uppercase tracking-[0.06em] text-[#555]">{pick ? (pick.isObStandIn ? 'OB' : thruLabel(pick.thru)) : '—'}</div>
                          </div>
                        )
                      })}
                    </div>
                    {outOfBoundsPicks.length > 0 && (
                      <div className="border-t-2 border-[#111] bg-[#efeee6] px-2 py-1.5 text-left">
                        <div className="mb-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#111]">Out of Bounds Golfers</div>
                        <div className="flex flex-wrap gap-1">
                          {outOfBoundsPicks.map(pick => (
                            <span key={`${entry.entryId}-${pick.name}`} className="border border-[#111] bg-[#fbfbf5] px-1.5 py-1 text-[10px] font-black uppercase leading-none text-[#111]">
                              <span className={scoreClass(pick.scoreToPar)}>{formatScore(pick.scoreToPar)}</span> {shortName(pick.name, allPickNames)} <span className="text-[#555]">{pick.isObStandIn ? 'OB' : thruLabel(pick.thru)}</span>
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
                              <td key={i} className="border-b border-r border-[#111] bg-[#fbfbf5] px-1 py-1 text-center align-middle shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
                                <div className={`text-lg font-black leading-none ${scoreClass(pick?.scoreToPar ?? null)}`}>{pick ? formatScore(pick.scoreToPar) : '—'}</div>
                                <div className="mt-0.5 break-words text-[11px] font-black uppercase leading-tight tracking-[-0.01em] text-[#111] xl:text-xs">{pick ? shortName(pick.name, allPickNames) : '—'}</div>
                                <div className="mt-0.5 text-[8px] font-black uppercase tracking-[0.06em] text-[#555]">{pick ? (pick.isObStandIn ? 'OB' : thruLabel(pick.thru)) : '—'}</div>
                              </td>
                            )
                          })}
                          <td className={`border-b border-[#111] bg-[#fbfbf5] px-1 py-1.5 text-center text-3xl font-black ${scoreClass(entry.totalScore)}`}>{formatScore(entry.totalScore)}</td>
                        </tr>
                        {outOfBoundsPicks.length > 0 && (
                          <tr className="bg-[#efeee6]">
                            <td className="border-b border-r-2 border-[#111] bg-[#efeee6]" />
                            <td className="border-b border-r-2 border-[#111] bg-[#efeee6] px-2 py-1 text-left text-[9px] font-black uppercase tracking-[0.1em] text-[#111]">Out of Bounds Golfers</td>
                            <td className="border-b border-[#111] bg-[#efeee6] px-2 py-1 text-left" colSpan={countScores + 1}>
                              <div className="flex flex-wrap gap-1">
                                {outOfBoundsPicks.map(pick => (
                                  <span key={`${entry.entryId}-${pick.name}`} className="border border-[#111] bg-[#fbfbf5] px-1.5 py-1 text-[10px] font-black uppercase leading-none text-[#111]">
                                    <span className={scoreClass(pick.scoreToPar)}>{formatScore(pick.scoreToPar)}</span> {shortName(pick.name, allPickNames)} <span className="text-[#555]">{pick.isObStandIn ? 'OB' : thruLabel(pick.thru)}</span>
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
        </div>
      </div>
      <div className="gpp-board-post mx-auto mt-[-8px] h-20 w-14 border-x-4 border-[#003622] md:h-28 md:w-16" />
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

export default function DashboardActivePools({ cards, entriesByPool }: { cards: ActivePoolCard[]; entriesByPool: Record<string, EntryRecord[]> }) {
  const router = useRouter()
  const [expandedPoolIds, setExpandedPoolIds] = useState<Set<string>>(() => new Set())
  const [expandedEntryIds, setExpandedEntryIds] = useState<Record<string, Set<string>>>(() => ({}))
  const [secondsToRefresh, setSecondsToRefresh] = useState(60)

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
      if (filtered.size === 0 && cards[0]?.pool.id) filtered.add(cards[0].pool.id)
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
        <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-[#d7c99f]">Active / recent pools</h2>
        <span className="border border-[#d7c99f] px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#f3df9c]">Refresh {secondsToRefresh}s</span>
      </div>
      <div className="divide-y divide-[#eadfca]">
        {cards.map(({ pool, tournament, role, entry }, index) => {
          const label = statusLabel(pool, tournament)
          const poolEntries = entriesByPool[pool.id] || (entry ? [entry] : [])
          const rankPreview = entry ? buildRankPreview(entry, pool, poolEntries) : null
          const isPoolOpen = expandedPoolIds.has(pool.id)
          const openEntryIds = expandedEntryIds[pool.id] ?? null
          const eventBegun = hasEventBegun(tournament)
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
                    <p className="mt-1 break-words text-sm font-semibold leading-5 text-[#1f2a24]">{tournament?.name || 'Tournament'}</p>
                  </div>
                  {hasRecentScores(tournament) ? <LivePulseBadge /> : <StatusBadge label={label} locked={Boolean(pool.is_locked)} />}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#657168]">
                  <span className="mr-auto inline-flex items-center border border-[#123c2f] bg-white px-2 py-1 text-[#123c2f] group-open:hidden" aria-label="Expand leaderboard">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" /></svg>
                  </span>
                  <span className="mr-auto hidden items-center border border-[#123c2f] bg-[#123c2f] px-2 py-1 text-white group-open:inline-flex" aria-label="Collapse leaderboard">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 10l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" /></svg>
                  </span>
                  {rankPreview?.rank ? <span className="whitespace-nowrap border border-[#b58a3a] bg-[#fff4cf] px-2 py-1 text-[#7a5a19]">Rank #{rankPreview.rank}</span> : null}
                  {eventBegun ? <ScoreBadge score={rankPreview?.totalScore} /> : <StartDateBadge date={tournament?.start_date} />}
                </div>
              </summary>
              <InlineLeaderboard
                pool={pool}
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
              />
              <div className="border-t border-[#eadfca] bg-[#fbf7ed] px-3 py-3 sm:px-5 sm:py-4">
                <TournamentLeaderboard
                  leaderboard={tournament?.leaderboard_json}
                  tournamentName={tournament?.name}
                  lastUpdated={tournament?.last_scores_fetch}
                  pickedGolfers={entryPicks(entry)}
                  cutLine={tournament?.cutLine}
                />
              </div>
            </details>
          )
        })}
      </div>
    </section>
  )
}
