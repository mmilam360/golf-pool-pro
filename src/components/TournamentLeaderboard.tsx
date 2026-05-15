'use client'

import type { GolfPlayer } from '@/lib/golf-api'

type Props = {
  leaderboard?: GolfPlayer[] | null
  tournamentName?: string | null
  lastUpdated?: string | null
  defaultOpen?: boolean
  compact?: boolean
}

function formatScore(score: number | null | undefined) {
  if (score == null) return '—'
  if (score === 0) return 'E'
  return score > 0 ? `+${score}` : String(score)
}

function scoreClass(score: number | null | undefined) {
  if (score == null) return 'text-[#657168]'
  return score < 0 ? 'text-[#b21e23]' : 'text-[#1f2a24]'
}

function positionLabel(player: GolfPlayer, index: number) {
  const raw = String(player.position || '').trim()
  if (raw) return raw.startsWith('T') ? raw : raw
  return String(index + 1)
}

function thruLabel(thru?: string) {
  if (!thru) return '—'
  const value = String(thru).toUpperCase()
  if (value === 'F') return 'F'
  return value
}

function statusLabel(player: GolfPlayer) {
  if (player.status === 'cut') return 'CUT'
  if (player.status === 'wd') return 'WD'
  if (player.status === 'dnq') return 'DNQ'
  return thruLabel(player.thru)
}

function updatedLabel(value?: string | null) {
  if (!value) return ''
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return ''
  return parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function TournamentLeaderboard({ leaderboard, tournamentName, lastUpdated, defaultOpen = false }: Props) {
  const rows = Array.isArray(leaderboard) ? leaderboard : []
  if (rows.length === 0) return null

  const updated = updatedLabel(lastUpdated)

  return (
    <details className="group border-2 border-[#d8cab0] bg-white shadow-[4px_4px_0_#eadfca]" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 bg-[#fbf7ed] px-2.5 py-2 text-left [&::-webkit-details-marker]:hidden sm:px-4 sm:py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#657168]">Tournament leaderboard</p>
          <p className="mt-0.5 truncate text-base font-black leading-5 text-[#123c2f] sm:text-lg">{tournamentName || 'Full tournament field'}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {updated ? <span className="hidden border border-[#d8cab0] bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#657168] sm:inline-flex">Updated {updated}</span> : null}
          <span className="border border-[#123c2f] bg-white px-2 py-1 text-[#123c2f] group-open:hidden" aria-label="Open tournament leaderboard">
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" /></svg>
          </span>
          <span className="hidden border border-[#123c2f] bg-[#123c2f] px-2 py-1 text-white group-open:inline-flex" aria-label="Close tournament leaderboard">
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 10l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" /></svg>
          </span>
        </div>
      </summary>
      <div className="border-t border-[#d8cab0] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eadfca] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#657168] sm:px-4 sm:text-[11px]">
          <span>Full tournament field. Pool standings are separate.</span>
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
              {rows.map((player, index) => (
                <tr key={`${player.id}-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-[#fbf7ed]'}>
                  <td className="border-b border-r border-[#eadfca] px-1 py-1 text-center text-[10px] font-black text-[#657168] sm:px-2 sm:py-1.5 sm:text-xs">{positionLabel(player, index)}</td>
                  <td className="border-b border-[#eadfca] px-1.5 py-1 sm:px-2 sm:py-1.5">
                    <div className="min-w-0 truncate font-black leading-4 text-[#1f2a24] sm:leading-5" title={player.name}>{player.name}</div>
                    {player.country ? <div className="text-[8px] font-bold uppercase tracking-[0.06em] text-[#657168] sm:text-[10px] sm:tracking-[0.08em]">{player.country}</div> : null}
                  </td>
                  <td className={`border-b border-l border-[#eadfca] px-1 py-1 text-center text-sm font-black sm:px-2 sm:py-1.5 sm:text-lg ${scoreClass(player.scoreToPar)}`}>{formatScore(player.scoreToPar)}</td>
                  <td className="border-b border-l border-[#eadfca] px-1 py-1 text-center text-[11px] font-black text-[#657168] sm:px-2 sm:py-1.5 sm:text-xs">{player.roundScore || '—'}</td>
                  <td className="border-b border-l border-[#eadfca] px-1 py-1 text-center text-[10px] font-black uppercase text-[#1f2a24] sm:px-2 sm:py-1.5 sm:text-xs">{statusLabel(player)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  )
}
