'use client'

import { Fragment, useEffect, useState } from 'react'
import { teeTimeLabel, tournamentThruLabel } from '@/lib/golfer-status'
import type { GolfCutLine, GolfPlayer } from '@/lib/golf-api'

type Props = {
  leaderboard?: GolfPlayer[] | null
  tournamentName?: string | null
  lastUpdated?: string | null
  defaultOpen?: boolean
  compact?: boolean
  pickedGolfers?: string[]
  cutLine?: GolfCutLine | null
}

const DEFAULT_TEE_TIME_ZONE = 'America/New_York'

function formatScore(score: number | null | undefined) {
  if (score == null) return '—'
  if (score === 0) return 'E'
  return score > 0 ? `+${score}` : String(score)
}

function scoreClass(score: number | null | undefined) {
  if (score == null) return 'text-[#657168]'
  return score < 0 ? 'text-[#b21e23]' : 'text-[#1f2a24]'
}

function normalizedName(name?: string | null) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function positionLabel(player: GolfPlayer, index: number) {
  const raw = String(player.position || '').trim()
  if (raw) return raw.startsWith('T') ? raw : raw
  return String(index + 1)
}

function statusLabel(player: GolfPlayer, timeZone: string) {
  return tournamentThruLabel(player, timeZone)
}

function updatedLabel(value?: string | null) {
  if (!value) return ''
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return ''
  return parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function todayLabel(player: GolfPlayer, timeZone: string) {
  if (player.status === 'cut') return 'CUT'
  if (player.status === 'wd') return 'WD'
  if (player.status === 'dnq') return 'DNQ'
  return player.roundScore || teeTimeLabel(player, timeZone) || '—'
}

function shouldShowCutLineAfter(rows: GolfPlayer[], index: number, cutLine?: GolfCutLine | null) {
  if (!cutLine) return false
  const current = rows[index]
  const next = rows[index + 1]
  if (!current || !next) return false
  if (Number.isFinite(cutLine.scoreToPar)) {
    return current.scoreToPar <= cutLine.scoreToPar && next.scoreToPar > cutLine.scoreToPar
  }
  return Boolean(cutLine.count && index + 1 === cutLine.count)
}

export function TournamentLeaderboard({ leaderboard, tournamentName, lastUpdated, defaultOpen = false, pickedGolfers = [], cutLine }: Props) {
  const [teeTimeZone, setTeeTimeZone] = useState(DEFAULT_TEE_TIME_ZONE)
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const rows = Array.isArray(leaderboard) ? leaderboard : []
  const displayRows = [...rows].sort((a, b) => {
    const aCut = a.status === 'cut'
    const bCut = b.status === 'cut'
    if (aCut !== bCut) return aCut ? 1 : -1
    return (a.scoreToPar ?? 999) - (b.scoreToPar ?? 999)
  })
  const hasOfficialCuts = displayRows.some(player => player.status === 'cut') && cutLine && !cutLine.projected

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (detected) setTeeTimeZone(detected)
  }, [])

  if (rows.length === 0) return null

  const updated = updatedLabel(lastUpdated)
  const pickedNames = new Set(pickedGolfers.map(normalizedName).filter(Boolean))
  const hasPickedGolfers = pickedNames.size > 0

  return (
    <details className="group border-2 border-[#d8cab0] bg-white shadow-[4px_4px_0_#eadfca]" open={isOpen} onToggle={event => setIsOpen(event.currentTarget.open)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 bg-[#fbf7ed] px-2.5 py-2 text-left [&::-webkit-details-marker]:hidden sm:px-4 sm:py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#657168]">Tournament leaderboard</p>
          <p className="mt-0.5 truncate text-base font-black leading-5 text-[#123c2f] sm:text-lg">{tournamentName || 'Full tournament field'}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {updated ? <span className="hidden border border-[#d8cab0] bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#657168] sm:inline-flex">Updated {updated}</span> : null}
          <span className={`border border-[#123c2f] px-2 py-1 ${isOpen ? 'bg-[#123c2f] text-white' : 'bg-white text-[#123c2f]'}`} aria-label={isOpen ? 'Close tournament leaderboard' : 'Open tournament leaderboard'}>
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d={isOpen ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'} stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" /></svg>
          </span>
        </div>
      </summary>
      <div className="border-t border-[#d8cab0] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eadfca] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#657168] sm:px-4 sm:text-[11px]">
          <span>{hasPickedGolfers ? 'Full tournament field. Your picks are highlighted.' : 'Full tournament field. Pool standings are separate.'}</span>
          {cutLine && !hasOfficialCuts ? <span>{cutLine.projected ? 'Projected cut' : 'Cut line'} {cutLine.score}</span> : null}
          {updated ? <span className="sm:hidden">Updated {updated}</span> : null}
        </div>
        <div className="max-h-[260px] overflow-y-auto overscroll-contain sm:max-h-[460px]">
          <table className="w-full table-fixed border-collapse text-xs sm:text-sm">
            <thead className="sticky top-0 z-10 bg-[#123c2f] text-[9px] font-black uppercase tracking-[0.08em] text-white sm:text-[10px] sm:tracking-[0.12em]">
              <tr>
                <th className="w-9 border-r border-[#2c5b4c] px-1 py-1.5 text-center sm:w-12 sm:px-2 sm:py-2">Pos</th>
                <th className="px-1.5 py-1.5 text-left sm:px-2 sm:py-2">Golfer</th>
                <th className="w-12 border-l border-[#2c5b4c] px-1 py-1.5 text-center sm:w-16 sm:px-2 sm:py-2">Tot</th>
                <th className="w-12 border-l border-[#2c5b4c] px-1 py-1.5 text-center sm:w-16 sm:px-2 sm:py-2">Today</th>
                <th className="w-10 border-l border-[#2c5b4c] px-1 py-1.5 text-center sm:w-14 sm:px-2 sm:py-2">Thru</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((player, index) => {
                const isPicked = pickedNames.has(normalizedName(player.name))
                const showCutLine = !hasOfficialCuts && shouldShowCutLineAfter(displayRows, index, cutLine)
                return (
                  <Fragment key={`${player.id}-${index}`}>
                    <tr className={isPicked ? 'bg-[#eef7ef]' : index % 2 === 0 ? 'bg-white' : 'bg-[#fbf7ed]'}>
                      <td className={`border-b border-r border-[#eadfca] px-1 py-1 text-center text-[10px] font-black sm:px-2 sm:py-1.5 sm:text-xs ${isPicked ? 'text-[#123c2f]' : 'text-[#657168]'}`}>{positionLabel(player, index)}</td>
                      <td className={`border-b border-[#eadfca] px-1.5 py-1 sm:px-2 sm:py-1.5 ${isPicked ? 'shadow-[inset_3px_0_0_#123c2f]' : ''}`}>
                        <div className={`min-w-0 truncate font-black leading-4 sm:leading-5 ${isPicked ? 'text-[#123c2f]' : 'text-[#1f2a24]'}`} title={player.name}>{player.name}</div>
                        {player.country ? <div className="text-[8px] font-bold uppercase tracking-[0.06em] text-[#657168] sm:text-[10px] sm:tracking-[0.08em]">{player.country}</div> : null}
                      </td>
                      <td className={`border-b border-l border-[#eadfca] px-1 py-1 text-center text-sm font-black sm:px-2 sm:py-1.5 sm:text-lg ${isPicked ? 'bg-[#dff0e2] text-[#123c2f]' : scoreClass(player.scoreToPar)}`}>{formatScore(player.scoreToPar)}</td>
                      {player.status === 'cut' ? (
                        <td colSpan={2} className="border-b border-l border-[#eadfca] bg-[#efeee6] px-1 py-1 text-center text-[10px] font-black uppercase tracking-[0.12em] text-[#b21e23] sm:px-2 sm:py-1.5 sm:text-xs">CUT</td>
                      ) : (
                        <>
                          <td className="border-b border-l border-[#eadfca] px-1 py-1 text-center text-[11px] font-black text-[#657168] sm:px-2 sm:py-1.5 sm:text-xs">{todayLabel(player, teeTimeZone)}</td>
                          <td className="border-b border-l border-[#eadfca] px-1 py-1 text-center text-[10px] font-black uppercase text-[#1f2a24] sm:px-2 sm:py-1.5 sm:text-xs">{statusLabel(player, teeTimeZone)}</td>
                        </>
                      )}
                    </tr>
                    {showCutLine ? (
                      <tr>
                        <td colSpan={5} className="border-b border-[#b58a3a] bg-[#fff4cf] px-2 py-1 text-center text-[10px] font-black uppercase tracking-[0.12em] text-[#7a5a19]">
                          {cutLine?.projected ? 'Projected cut' : 'Cut line'} {cutLine?.score}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  )
}
