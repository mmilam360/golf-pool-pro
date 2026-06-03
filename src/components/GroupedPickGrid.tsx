'use client'

import type { PickGroup } from '@/lib/pool-formats'

export type PickState = {
  rawName: string
  displayName: string
  selected: boolean
  disabled: boolean
  pickNumber: number | null
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
    <div className="mx-auto w-fit max-w-full bg-transparent">
      <div className="mb-2 flex w-fit max-w-full items-center justify-between gap-3 border-b border-[#d8cab0] pb-1 pr-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#0f2f25]">
        <span className="truncate">{groupLabel}</span>
        <span className="ml-1 flex-shrink-0 text-[#8a6724]">{selectedCount}/{picksRequired}</span>
      </div>

      <div className="inline-flex w-max max-w-full flex-col overflow-hidden border-y border-[#d8cab0] bg-white">
        {pickStates.map(({ rawName, displayName, selected, disabled, pickNumber }) => (
          <button
            key={rawName}
            type="button"
            onClick={() => !disabled && onToggle(rawName)}
            disabled={disabled}
            className={`flex w-full min-w-[14rem] max-w-full items-center justify-between gap-4 border-x border-b border-[#d8cab0] px-3 py-2 text-left text-sm font-bold leading-tight last:border-b-0 transition-colors sm:min-w-[17.5rem] ${
              selected
                ? 'bg-[#123c2f] text-white'
                : disabled
                  ? 'cursor-not-allowed text-stone-400'
                  : 'text-stone-800 hover:bg-[#fbf7ed]'
            }`}
          >
            <span className="truncate pr-2">{displayName}</span>
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

          const pickStates: PickState[] = [...group.players].sort((a, b) => golferListName(a.name).localeCompare(golferListName(b.name), undefined, { sensitivity: 'base' })).map(player => {
            const selected = myPicks.includes(player.name)
            const disabled = readOnly || (!selected && selectedCount >= picksPerGroup)
            return {
              rawName: player.name,
              displayName: golferListName(player.name),
              selected,
              disabled,
              pickNumber: selected ? myPicks.indexOf(player.name) + 1 : null,
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