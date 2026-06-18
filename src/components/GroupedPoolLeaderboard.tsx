'use client'

import { Fragment } from 'react'
import type { PickGroup } from '@/lib/pool-formats'
import type { PickScore, ScoredEntry } from '@/lib/scoring'
import type { GolfPlayer } from '@/lib/golf-api'
import { leaderboardBackedPickProgressLabel } from '@/lib/golfer-status'
import { normalizePickName } from '@/lib/scoring'

export type GroupedPoolLeaderboardProps = {
  entries: ScoredEntry[]
  pickGroups: PickGroup[]
  picksPerGroup: number
  myEntryId?: string | null
  highlightedEntryId?: string | null
  openEntryIds?: Set<string>
  setOpenEntryIds?: (fn: (prev: Set<string>) => Set<string>) => void
  forceOpenEntryId?: string | null
  onJumpToMine?: () => void
  showJumpToMine?: boolean
  leaderboard?: GolfPlayer[]
  timeZone?: string
}

function fmt(score: number | null) {
  if (score === null) return '—'
  if (score === 0) return 'E'
  return score > 0 ? `+${score}` : String(score)
}

function cls(score: number | null) {
  if (score === null) return 'text-stone-400'
  return score < 0 ? 'text-[#b21e23]' : 'text-[#111]'
}

function highlightedRowBg(highlighted: boolean) {
  return highlighted ? 'bg-[#eaf5ec]' : 'bg-[#f7f7f2]'
}

function highlightedCellBg(highlighted: boolean) {
  return highlighted ? 'bg-[#eaf5ec]' : 'bg-[#fbfbf5]'
}

function highlightedSummaryBg(highlighted: boolean) {
  return highlighted
    ? 'bg-[#eaf5ec] hover:bg-[#eaf5ec] group-open:bg-[#eaf5ec]'
    : 'bg-[#f7f7f2] hover:bg-[#fffdf4] group-open:bg-[#fffdf4]'
}

function pickStatus(pick: PickScore, leaderboardByName: Map<string, GolfPlayer>, timeZone: string) {
  const player = leaderboardByName.get(normalizePickName(pick.name))
  return leaderboardBackedPickProgressLabel(pick, player, timeZone)
}

function shortName(name: string) {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length <= 1) return name
  return parts[parts.length - 1]
}

export function GroupedPoolLeaderboard({
  entries,
  pickGroups,
  picksPerGroup,
  myEntryId,
  highlightedEntryId,
  openEntryIds,
  setOpenEntryIds,
  forceOpenEntryId,
  onJumpToMine,
  showJumpToMine,
  leaderboard = [],
  timeZone = 'America/New_York',
}: GroupedPoolLeaderboardProps) {
  const leaderboardByName = new Map(leaderboard.map(p => [normalizePickName(p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim()), p]))
  /* Mobile: details rows with group expansion */
  const mobileView = (
    <div className="bg-[#f7f7f2]">
      {entries.map(entry => {
        const isMe = entry.entryId === myEntryId
        const isHighlighted = highlightedEntryId === entry.entryId
        const picksHidden = entry.picks.includes('__hidden__')
        const isEntryOpen = (openEntryIds?.has(entry.entryId) ?? false) || forceOpenEntryId === entry.entryId
        const groupRows = pickGroups.map(group => {
          const inGroup = entry.pickScores.filter(ps =>
            group.players.some(p => p.name.trim().toLowerCase() === ps.name.trim().toLowerCase())
          )
          return { group, picks: inGroup }
        })
        return (
          <details
            id={`entry-card-${entry.entryId}`}
            key={entry.entryId}
            open={isEntryOpen}
            onToggle={event => {
              const open = event.currentTarget.open
              const setter = setOpenEntryIds
              if (!setter) return
              setter(current => {
                const next = new Set(current)
                if (open) next.add(entry.entryId)
                else next.delete(entry.entryId)
                return next
              })
            }}
            className={`group border-b-2 border-[#d8cab0] transition-colors ${isHighlighted ? 'bg-[#eaf5ec]' : ''}`}
          >
            <summary className={`grid min-h-[58px] cursor-pointer list-none grid-cols-[34px_minmax(0,1fr)_58px_18px] items-center gap-1 px-2 py-2 text-left transition-colors sm:grid-cols-[44px_minmax(0,1fr)_74px_20px] sm:gap-2 [&::-webkit-details-marker]:hidden ${highlightedSummaryBg(isHighlighted)}`}>
              <div className="text-center tallk:text-2xl font-black text-[#b21e23]">{entry.rank || '—'}</div>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  {isMe && <span aria-label="Your entry" className="h-2.5 w-2.5 shrink-0 bg-[#005b3c]" />}
                  <span className="min-w-0 flex-1 break-words text-sm font-black uppercase leading-tight tracking-[0.02em] text-[#111] sm:text-base sm:tracking-[0.04em]">{entry.displayName}</span>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-black leading-none ${cls(entry.totalScore)}`}>{fmt(entry.totalScore)}</div>
              </div>
              <div className="flex items-center justify-center text-[#111]">
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                  <path d={isEntryOpen ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'} stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" />
                </svg>
                <span className="sr-only">Toggle</span>
              </div>
            </summary>
            {picksHidden ? (
              <div className="bg-[#efeee6] px-4 py-3 text-sm font-semibold text-stone-600">Picks hidden until lock</div>
            ) : (
              <div className="border-t border-[#d8cab0] bg-[#fbfbf5]">
                {groupRows.map(({ group, picks }) => (
                  <div key={group.id} className="border-b border-[#d8cab0] px-3 py-2">
                    <div className="mb-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#123c2f]">{group.label}</div>
                    <div className="flex flex-wrap gap-3">
                      {picks.map(pick => {
                        const isOut = !pick.counted
                        return (
                          <div key={pick.name} className="flex items-center gap-1.5">
                            {isOut && (
                              <svg className="h-3.5 w-3.5 shrink-0 text-[#b21e23]" viewBox="0 0 16 16" fill="none">
                                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
                              </svg>
                            )}
                            <span className={`text-lg font-black leading-none ${cls(pick.scoreToPar)}`}>{fmt(pick.scoreToPar)}</span>
                            <span className="text-[11px] font-black uppercase tracking-[-0.01em] text-[#111]">{shortName(pick.name)}</span>
                            <span className="text-[9px] font-black uppercase tracking-[0.06em] text-[#555]">{pickStatus(pick, leaderboardByName, timeZone)}</span>
                          </div>
                        )
                      })}
                      {picks.length === 0 && <span className="text-xs text-stone-500">—</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </details>
        )
      })}
    </div>
  )

  /* Desktop: table with group columns */
  const desktopView = (
    <table className="w-full table-fixed border-collapse text-[12px] text-[#111]">
      <thead>
        <tr className="bg-[#f7f7f2] text-[10px] font-black uppercase tracking-[0.12em] text-[#111]">
          <th className="w-[5%] border-b-2 border-r-2 border-[#d8cab0] px-1 py-1.5 text-center">Rank</th>
          <th className="w-[18%] border-b-2 border-r-2 border-[#d8cab0] px-2 py-1.5 text-left">Entry</th>
          {pickGroups.map(group => (
            <th key={group.id} className="border-b-2 border-r-2 border-[#d8cab0] px-1 py-1.5 text-center" colSpan={picksPerGroup}>{group.label}</th>
          ))}
          <th className="w-[9%] border-b-2 border-[#d8cab0] px-1 py-1.5 text-center">Total</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(entry => {
          const isMe = entry.entryId === myEntryId
          const isHighlighted = highlightedEntryId === entry.entryId
          const picksHidden = entry.picks.includes('__hidden__')
          const totalPicks = pickGroups.length * picksPerGroup
          return (
            <tr
              id={`entry-row-${entry.entryId}`}
              key={entry.entryId}
              className={`transition-colors ${highlightedRowBg(isHighlighted)}`}
            >
              <td className={`border-b border-r-2 border-[#d8cab0] px-1 py-1.5 text-center text-xl font-black text-[#b21e23] ${highlightedRowBg(isHighlighted)}`}>
                {entry.rank || '—'}
              </td>
              <td className={`border-b border-r-2 border-[#d8cab0] px-2 py-1.5 text-left ${highlightedRowBg(isHighlighted)}`}>
                <div className="flex min-w-0 items-center gap-1.5">
                  {isMe && <span aria-label="Your entry" className="h-2.5 w-2.5 shrink-0 bg-[#005b3c]" />}
                  <span className="truncate text-base font-black uppercase tracking-[0.02em] text-[#111]" title={entry.displayName}>{entry.displayName}</span>
                </div>
              </td>
              {picksHidden ? (
                <td className="border-b border-r-2 border-[#d8cab0] bg-[#efeee6] px-2 py-1.5 text-center text-xs font-semibold text-stone-500" colSpan={totalPicks}>
                  Picks hidden until lock
                </td>
              ) : pickGroups.map(group => {
                const inGroup = entry.pickScores.filter(ps =>
                  group.players.some(p => p.name.trim().toLowerCase() === ps.name.trim().toLowerCase())
                )
                const cells: (PickScore | null)[] = []
                for (let i = 0; i < picksPerGroup; i++) cells.push(inGroup[i] ?? null)
                return cells.map((pick, i) => (
                  <td
                    key={`${group.id}-${i}`}
                    className={`relative border-b border-r border-[#d8cab0] px-1 py-1 text-center align-middle ${highlightedCellBg(isHighlighted)}`}
                  >
                    {pick ? (
                      <>
                        {!pick.counted && (
                          <svg className="absolute right-0.5 top-0.5 h-3.5 w-3.5 text-[#b21e23]" viewBox="0 0 16 16" fill="none">
                            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
                          </svg>
                        )}
                        <div className={`text-lg font-black leading-none ${cls(pick.scoreToPar)}`}>{fmt(pick.scoreToPar)}</div>
                        <div className="mt-0.5 break-words text-[11px] font-black uppercase leading-tight tracking-[-0.01em] text-[#111] xl:text-xs">{shortName(pick.name)}</div>
                        <div className="mt-0.5 text-[8px] font-black uppercase tracking-[0.06em] text-[#555]">{pickStatus(pick, leaderboardByName, timeZone)}</div>
                      </>
                    ) : (
                      <span className="text-stone-400">—</span>
                    )}
                  </td>
                ))
              })}
              <td className={`border-b border-[#d8cab0] px-1 py-1.5 text-center align-middle ${highlightedCellBg(isHighlighted)}`}>
                <div className={`text-3xl font-black leading-none ${cls(entry.totalScore)}`}>{fmt(entry.totalScore)}</div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )

  return (
    <Fragment>
      <div className="bg-[#f7f7f2] lg:hidden">{mobileView}</div>
      <div className="hidden bg-[#f7f7f2] lg:block">{desktopView}</div>
      {showJumpToMine && onJumpToMine && entries.length >= 10 && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onJumpToMine}
            className="border-2 border-[#123c2f] bg-[#123c2f] px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-white shadow-[2px_2px_0_#b58a3a] transition-colors hover:bg-[#0f2f25]"
          >Jump to my entry</button>
        </div>
      )}
    </Fragment>
  )
}
