'use client'

import { useState } from 'react'
import { trackGppEvent } from '@/lib/posthog-events'

function OldWayPanel() {
  return (
    <div className="h-full border-2 border-stone-400 bg-[#f3f3f3] p-3 text-stone-900 shadow-[3px_3px_0_#b8b8b8] sm:p-4">
      <div className="border border-stone-500 bg-[#d9e8ff] px-2 py-1 text-xs font-bold text-blue-900">Golf Pool Manager</div>
      <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-blue-700 underline">
        <span>Home</span><span>|</span><span>Rules</span><span>|</span><span>Picks</span><span>|</span><span>Standings</span><span>|</span><span>Admin</span>
      </div>
      <div className="mt-3 border border-stone-500 bg-white p-2">
        <p className="mb-2 text-xs font-bold">Leaderboard</p>
        <div className="grid grid-cols-[28px_1fr_52px] border-y border-stone-400 bg-stone-200 text-[10px] font-bold uppercase">
          <span className="border-r border-stone-400 px-1 py-1">#</span>
          <span className="border-r border-stone-400 px-1 py-1">Player</span>
          <span className="px-1 py-1 text-right">Score</span>
        </div>
        {['Mike', 'John', 'Steve', 'Brian'].map((name, index) => (
          <div key={name} className="grid grid-cols-[28px_1fr_52px] border-b border-stone-300 text-[11px]">
            <span className="border-r border-stone-300 px-1 py-1">{index + 1}</span>
            <span className="border-r border-stone-300 px-1 py-1">{name}</span>
            <span className="px-1 py-1 text-right">-{12 - index * 2}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-stone-700">Works, but it feels like admin software. Fine on desktop. Clunky in a group text.</p>
    </div>
  )
}

function GppPanel() {
  return (
    <div className="h-full border-2 border-[#123c2f] bg-[#fbf7ed] p-3 shadow-[4px_4px_0_#d8cab0] sm:p-4">
      <div className="flex items-center justify-between border-b-2 border-[#123c2f] pb-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a6724]">Golf Pools Pro</p>
          <p className="font-display text-2xl text-[#123c2f]">Clubhouse board</p>
        </div>
        <span className="border-2 border-[#b21e23] px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#b21e23]">Live</span>
      </div>
      <div className="mt-3 space-y-2">
        {[
          ['1', 'Lonnie', '-26'],
          ['2', 'Jeff', '-25'],
          ['3', 'Dan M', '-21'],
        ].map(([rank, name, score]) => (
          <div key={name} className="grid grid-cols-[34px_1fr_56px] items-center gap-2 border-2 border-[#123c2f] bg-white px-2 py-2 text-sm">
            <div className="text-center font-black text-[#8a6724]">#{rank}</div>
            <div className="min-w-0">
              <p className="truncate font-black uppercase text-[#123c2f]">{name}</p>
            </div>
            <div className="text-right font-display text-xl text-[#b21e23]">{score}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 text-stone-700">Made for phones, live standings, invite links, and fewer rule arguments.</p>
    </div>
  )
}

export function OldWayVsGppSlider() {
  const [value, setValue] = useState(55)

  return (
    <div className="border-2 border-[#123c2f] bg-white p-4 shadow-[5px_5px_0_#d8cab0]">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">Old pool site feel</p>
          <OldWayPanel />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a6724]">Golf Pools Pro</p>
          <GppPanel />
        </div>
      </div>
      <div className="mt-5 border-t-2 border-dashed border-[#d8cab0] pt-4">
        <div className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.14em] text-stone-600">
          <span>Plain admin</span>
          <span>More clubhouse</span>
        </div>
        <input
          aria-label="Compare old pool sites with Golf Pools Pro"
          className="mt-3 h-2 w-full accent-[#123c2f]"
          max="100"
          min="0"
          type="range"
          value={value}
          onChange={(event) => setValue(Number(event.target.value))}
          onPointerUp={() => trackGppEvent('first_pool_9_compare_slider_changed', { value })}
        />
      </div>
    </div>
  )
}
