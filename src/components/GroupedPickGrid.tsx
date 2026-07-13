'use client'

import type { PickGroup } from '@/lib/pool-formats'

export type PickState = {
  rawName: string
  displayName: string
  rankingLabel: string
  selected: boolean
  disabled: boolean
  pickNumber: number | null
  hasRankedMeta: boolean
}

function formatAmericanOdds(value: number | null | undefined) {
  if (!Number.isFinite(value) || Number(value) === 0) return ''
  const rounded = Math.round(Number(value))
  return rounded > 0 ? `+${rounded}` : String(rounded)
}

function playerRankingLabel(player: PickGroup['players'][number]) {
  if (!player.rankSource) return ''
  const odds = formatAmericanOdds(player.americanOdds)
  const owgr = Number.isFinite(player.owgrRank) && Number(player.owgrRank) > 0
    ? `OWGR ${Math.round(Number(player.owgrRank))}`
    : ''
  return [odds, owgr].filter(Boolean).join(' / ')
}

function GroupPickCard({
  groupLabel,
  picksRequired,
  pickStates,
  onToggle,
  totalPicksRequired,
}: {
  groupLabel: string
  picksRequired: number
  pickStates: PickState[]
  onToggle: (rawName: string) => void
  totalPicksRequired: number
}) {
  const selectedCount = pickStates.filter(p => p.selected).length

  return (
    <div className="w-full bg-transparent">
      <div className="mb-2 flex w-full items-center justify-between gap-3 border-b border-[#d8cab0] pb-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#0f2f25]">
        <span className="truncate">{groupLabel}</span>
        <span className="ml-1 flex-shrink-0 text-[#8a6724]">{selectedCount}/{picksRequired}</span>
      </div>

      <div className="grid w-full overflow-hidden border-x border-t border-[#d8cab0] bg-white sm:grid-cols-2">
        {pickStates.map(({ rawName, displayName, rankingLabel, selected, disabled, pickNumber, hasRankedMeta }) => (
          <button
            key={rawName}
            type="button"
            onClick={() => !disabled && onToggle(rawName)}
            disabled={disabled}
            className={`grid w-full grid-cols-[5.75rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#d8cab0] px-3 py-2 text-left text-sm font-bold leading-tight transition-colors sm:grid-cols-[6.35rem_minmax(0,1fr)_auto] sm:[&:nth-child(odd)]:border-r ${
              selected
                ? 'bg-[#123c2f] text-white'
                : disabled
                  ? 'cursor-not-allowed text-stone-400'
                  : 'text-stone-800 hover:bg-[#fbf7ed]'
            }`}
          >
            <span className={`min-w-0 border-r pr-3 text-[10px] font-black uppercase leading-[1.15] tracking-[0.08em] tabular-nums ${
              selected
                ? 'border-white/30 text-[#f4dfaa]'
                : hasRankedMeta
                  ? 'border-[#eadfca] text-[#8a6724]'
                  : 'border-[#eadfca] text-stone-400'
            }`}>
              {rankingLabel ? rankingLabel.split(' / ').map(piece => (
                <span key={piece} className="block truncate">{piece}</span>
              )) : <span className="block truncate">No rank</span>}
            </span>
            <span className="min-w-0 truncate">{displayName}</span>
            {selected && (
              <span className="shrink-0 border border-white/80 bg-white px-1.5 py-0.5 text-[10px] font-black text-[#123c2f]">
                {pickNumber}/{totalPicksRequired}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

export type GroupedPickGridProps = {
  pickGroups: PickGroup[]
  myPicks: string[]
  picksPerGroup: number
  readOnly: boolean
  golferListName: (name: string) => string
  onTogglePick: (name: string) => void
  groupLabelForDisplay?: (label: string) => string
}

export function GroupedPickGrid({
  pickGroups,
  myPicks,
  picksPerGroup,
  readOnly,
  golferListName,
  onTogglePick,
  groupLabelForDisplay = label => label,
}: GroupedPickGridProps) {
  const totalPicksRequired = pickGroups.length * picksPerGroup

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        {pickGroups.map(group => {
          const selectedCount = group.players.filter(p =>
            myPicks.includes(p.name)
          ).length

          const preserveRankedOrder = group.players.some(player => Boolean(player.rankSource))
          const orderedPlayers = preserveRankedOrder
            ? group.players
            : [...group.players].sort((a, b) => golferListName(a.name).localeCompare(golferListName(b.name), undefined, { sensitivity: 'base' }))
          const pickStates: PickState[] = orderedPlayers.map(player => {
            const selected = myPicks.includes(player.name)
            const disabled = readOnly || (!selected && selectedCount >= picksPerGroup)
            return {
              rawName: player.name,
              displayName: golferListName(player.name),
              rankingLabel: playerRankingLabel(player),
              selected,
              disabled,
              pickNumber: selected ? myPicks.indexOf(player.name) + 1 : null,
              hasRankedMeta: Boolean(player.rankSource),
            }
          })

          return (
            <div key={group.id} data-group-id={group.id}>
              <GroupPickCard
                groupLabel={groupLabelForDisplay(group.label)}
                picksRequired={picksPerGroup}
                pickStates={pickStates}
                onToggle={onTogglePick}
                totalPicksRequired={totalPicksRequired}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}