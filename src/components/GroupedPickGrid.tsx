'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { groupPickCounts, type PickGroup } from '@/lib/pool-formats'

export type PickState = {
  name: string
  selected: boolean
  disabled: boolean
}

export type GroupPickCardProps = {
  group: PickGroup
  pickState: PickState[]
  picksRequired: number
  onToggle: (name: string) => void
  isCollapsed: boolean
  isMobile: boolean
}

function GroupPickCard({ group, pickState, picksRequired, onToggle, isCollapsed, isMobile }: GroupPickCardProps) {
  const headerColor = pickState.filter(p => p.selected).length >= picksRequired
    ? 'bg-[#123c2f]'
    : 'bg-[#b21e23]'

  return (
    <div className={`flex-shrink-0 rounded-none border-2 border-[#2a2a2a] bg-white shadow-[3px_3px_0_#888] ${isMobile ? 'w-[9.5rem]' : 'w-[10.5rem]'}`}>
      {/* Title bar */}
      <div className={`flex items-center justify-between ${headerColor} px-2 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-white`}>
        <span className="truncate">{group.label}</span>
        <span className="ml-1 flex-shrink-0">{pickState.filter(p => p.selected).length}/{picksRequired}</span>
      </div>

      {/* Player rows */}
      <div className="border-t-2 border-[#2a2a2a]">
        {pickState.map(({ name, selected, disabled }, idx) => (
          <button
            key={name}
            type="button"
            onClick={() => !disabled && onToggle(name)}
            disabled={disabled}
            className={`flex w-full items-center justify-between border-b border-[#e0dcd0] px-2 py-1.5 text-left text-[12px] font-semibold leading-tight last:border-b-0 ${
              selected
                ? 'bg-[#eef7ef] text-[#123c2f]'
                : disabled
                  ? 'cursor-not-allowed text-stone-400'
                  : 'text-stone-800 hover:bg-[#fbf7ed]'
            }`}
          >
            <span className="truncate pr-1">{name}</span>
            {selected && (
              <span className="ml-1 flex-shrink-0 border border-[#123c2f] bg-white px-1 py-0 text-[9px] font-black uppercase tracking-[0.06em] text-[#123c2f]">
                {isCollapsed ? '✓' : 'PICK'}
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
  picksAreClosed: boolean
  golferListName: (name: string) => string
  onTogglePick: (name: string) => void
  onToggleAll: () => void
  allSelectedCount: number
}

export function GroupedPickGrid({
  pickGroups,
  myPicks,
  picksPerGroup,
  picksAreClosed,
  golferListName,
  onTogglePick,
  onToggleAll,
  allSelectedCount,
}: GroupedPickGridProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsMobile(window.innerWidth < 640)
    const onResize = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Auto-scroll to first incomplete group
  useEffect(() => {
    if (scrollRef.current && !picksAreClosed) {
      for (const group of pickGroups) {
        const selectedCount = group.players.filter(p => myPicks.includes(p.name)).length
        if (selectedCount < picksPerGroup) {
          const el = scrollRef.current.querySelector(`[data-group-id="${group.id}"]`)
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
          }
          break
        }
      }
    }
  }, [pickGroups, myPicks, picksPerGroup, picksAreClosed])

  const toggleCollapse = useCallback((groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }, [])

  const groupsRemaining = pickGroups.filter(group => {
    const selectedCount = group.players.filter(p => myPicks.includes(p.name)).length
    return selectedCount < picksPerGroup
  }).length

  const totalPicks = pickGroups.length * picksPerGroup

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-[#123c2f]">
            {allSelectedCount}/{totalPicks} picks
          </span>
          {groupsRemaining > 0 && (
            <span className="text-[11px] font-bold text-[#b21e23]">
              {groupsRemaining} group{groupsRemaining !== 1 ? 's' : ''} left
            </span>
          )}
          {groupsRemaining === 0 && (
            <span className="border border-[#123c2f] bg-[#eef7ef] px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#123c2f]">
              Complete
            </span>
          )}
        </div>
        {!picksAreClosed && (
          <button
            type="button"
            onClick={onToggleAll}
            className="border border-stone-400 bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-stone-700 hover:bg-stone-50"
          >
            View All
          </button>
        )}
      </div>

      {/* Horizontal scroll strip */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto px-1 pb-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        onScroll={e => {
          const el = e.currentTarget
          el.style.setProperty('--scroll-left', String(el.scrollLeft))
        }}
      >
        {pickGroups.map(group => {
          const groupPicks = groupPickCounts([group], myPicks)[0]?.picks || []
          const isCollapsed = collapsedGroups.has(group.id)

          const pickState: PickState[] = group.players.map(player => {
            const selected = myPicks.includes(player.name)
            const disabled = !selected && groupPicks.length >= picksPerGroup
            return {
              name: golferListName(player.name),
              selected,
              disabled,
            }
          })

          return (
            <div key={group.id} data-group-id={group.id}>
              <GroupPickCard
                group={group}
                pickState={pickState}
                picksRequired={picksPerGroup}
                onToggle={onTogglePick}
                isCollapsed={isCollapsed}
                isMobile={isMobile}
              />
            </div>
          )
        })}
      </div>

      {/* Scroll hints */}
      <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-stone-400">
        <span className="inline-block">&#8592;</span>
        <span>Scroll to compare groups</span>
        <span className="inline-block">&#8594;</span>
      </div>

      {/* Full-width selected summary (always visible under cards) */}
      <div className="mt-1 border-t border-[#d8cab0] px-1 pt-2">
        {groupPickCounts(pickGroups, myPicks).map(({ group, picks }) => (
          <div key={group.id} className="flex items-start justify-between gap-3 py-1">
            <span className="min-w-0 flex-shrink-0 text-[11px] font-black uppercase tracking-[0.08em] text-stone-600">
              {group.label}
            </span>
            <span className="truncate text-right text-[11px] font-bold text-stone-800">
              {picks.length === 0 ? '—' : picks.map(golferListName).join(", ")}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}