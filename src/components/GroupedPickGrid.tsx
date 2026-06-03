'use client'

import { useState } from 'react'
import type { PickGroup } from '@/lib/pool-formats'

export type PickState = {
  rawName: string
  displayName: string
  selected: boolean
  disabled: boolean
}

function GroupPickCard({
  groupLabel,
  picksRequired,
  pickStates,
  onToggle,
  isMobile,
}: {
  groupLabel: string
  picksRequired: number
  pickStates: PickState[]
  onToggle: (rawName: string) => void
  isMobile: boolean
}) {
  const completed = pickStates.filter(p => p.selected).length >= picksRequired
  const headerColor = completed ? 'bg-[#123c2f]' : 'bg-[#b21e23]'

  return (
    <div className={`rounded-none border-2 border-[#2a2a2a] bg-white shadow-[3px_3px_0_#888] ${isMobile ? 'w-[11rem]' : 'w-[13.5rem]'}`}>
      {/* Title bar */}
      <div className={`flex items-center justify-between ${headerColor} px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.08em] text-white`}>
        <span className="truncate">{groupLabel}</span>
        <span className="ml-1 flex-shrink-0">{pickStates.filter(p => p.selected).length}/{picksRequired}</span>
      </div>

      {/* Player rows */}
      <div className="border-t-2 border-[#2a2a2a]">
        {pickStates.map(({ rawName, displayName, selected, disabled }) => (
          <button
            key={rawName}
            type="button"
            onClick={() => !disabled && onToggle(rawName)}
            disabled={disabled}
            className={`flex w-full items-center justify-between border-b border-[#e0dcd0] px-2.5 py-[5px] text-left text-[12px] font-semibold leading-tight last:border-b-0 transition-colors ${
              selected
                ? 'bg-[#eef7ef] text-[#123c2f]'
                : disabled
                  ? 'cursor-not-allowed text-stone-400'
                  : 'text-stone-800 hover:bg-[#fbf7ed]'
            }`}
          >
            <span className="truncate pr-1">{displayName}</span>
            {selected && (
              <span className="ml-1 flex-shrink-0 border border-[#123c2f] bg-white px-1.5 py-0 text-[9px] font-black uppercase tracking-[0.06em] text-[#123c2f]">
                PICK
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
  const [isMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Cards: horizontal scroll on mobile, flex-wrap on desktop */}
      <div className="flex flex-nowrap gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
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
            }
          })

          return (
            <div key={group.id} data-group-id={group.id}>
              <GroupPickCard
                groupLabel={groupLabelForDisplay(group.label)}
                picksRequired={picksPerGroup}
                pickStates={pickStates}
                onToggle={onTogglePick}
                isMobile={isMobile}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}