'use client'

import type { PickGroup } from '@/lib/pool-formats'
import type { GolfPlayer } from '@/lib/golf-api'
import { normalizePickName } from '@/lib/scoring'
import { teeTimeLabel, tournamentThruLabel } from '@/lib/golfer-status'

type Props = {
  pickGroups: PickGroup[]
  leaderboard: GolfPlayer[]
  field: GolfPlayer[]
  timeZone?: string
}

function fmt(score: number | null) {
  if (score === null) return '—'
  if (score === 0) return 'E'
  return score > 0 ? `+${score}` : String(score)
}

function cls(score: number | null) {
  if (score === null) return 'text-[#657168]'
  return score < 0 ? 'text-[#b21e23]' : 'text-[#1f2a24]'
}

function shortName(name: string) {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length <= 1) return name
  return parts[parts.length - 1]
}

function playerScore(player: GolfPlayer | undefined) {
  if (!player) return { score: '—', cls: 'text-[#657168]', sort: 500 }
  if (player.status === 'cut') return { score: 'CUT', cls: 'text-[#b21e23]', sort: 999 }
  if (player.status === 'wd') return { score: 'WD', cls: 'text-[#657168]', sort: 998 }
  if (player.status === 'dnq') return { score: 'DNQ', cls: 'text-[#657168]', sort: 997 }
  const s = player.scoreToPar
  if (s == null) return { score: '—', cls: 'text-[#657168]', sort: 500 }
  return { score: fmt(s), cls: cls(s), sort: s }
}

export function TierFieldView({ pickGroups, leaderboard, field, timeZone = 'America/New_York' }: Props) {
  const playerByName = new Map<string, GolfPlayer>()
  // Prefer leaderboard for live scores, fallback to field for tee times
  const source = leaderboard.length > 0 ? leaderboard : field
  for (const p of source) {
    const key = normalizePickName(p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim())
    if (key) playerByName.set(key, p)
  }

  // If leaderboard is empty (pre-tournament), enrich with field tee times
  if (leaderboard.length === 0) {
    for (const p of field) {
      const key = normalizePickName(p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim())
      if (key && !playerByName.has(key)) playerByName.set(key, p)
    }
  }

  const tiers = pickGroups.map(group => {
    const golfers = group.players.map(gp => {
      const player = playerByName.get(normalizePickName(gp.name))
      return { groupPlayer: gp, player }
    }).sort((a, b) => {
      const sa = playerScore(a.player).sort
      const sb = playerScore(b.player).sort
      return sa - sb
    })
    return { group, golfers }
  })

  const hasAnyScores = source.some(p => p.scoreToPar != null && p.status === 'active')

  return (
    <div className="border-2 border-[#d8cab0] bg-[#f7f7f2]" style={{ fontFamily: 'Arial Narrow, Arial, sans-serif' }}>
      {/* Legend */}
      <div className="border-b-2 border-[#d8cab0] bg-[#fbf7ed] px-3 py-2">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#657168]">
          Field by tier{hasAnyScores ? ' · sorted low to high' : ' · tee times'}
        </p>
        <p className="mt-0.5 text-[10px] font-semibold leading-tight text-[#555]">
          T1 = highest-ranked World Golf Ranking players. Pick one from each tier.
        </p>
      </div>

      {tiers.map(({ group, golfers }) => (
        <div key={group.id} className="border-b border-[#d8cab0] last:border-b-0">
          {/* Tier header row */}
          <div className="flex items-center gap-2 bg-[#123c2f] px-3 py-1.5">
            <span className="text-sm font-black uppercase tracking-[0.08em] text-[#d8b45d]">{group.label.replace(/^Group\b/, 'Tier')}</span>
            <span className="text-[9px] font-black uppercase tracking-[0.08em] text-[#8aa89a]">
              {golfers.length} golfers
            </span>
          </div>
          {/* Golfers in this tier — horizontal scroll on mobile, wrap on desktop */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 py-2">
            {golfers.map(({ groupPlayer, player }) => {
              const sc = player ? playerScore(player) : { score: '—', cls: 'text-[#657168]', sort: 500 }
              const status = player ? (hasAnyScores ? tournamentThruLabel(player, timeZone) : teeTimeLabel(player, timeZone)) : ''
              return (
                <div key={groupPlayer.id} className="flex items-center gap-1.5">
                  <span className={`text-base font-black leading-none ${sc.cls}`}>{sc.score}</span>
                  <span className="text-[11px] font-black uppercase tracking-[-0.01em] text-[#111]">{shortName(groupPlayer.name)}</span>
                  {status ? <span className="text-[8px] font-black uppercase tracking-[0.06em] text-[#555]">{status}</span> : null}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
