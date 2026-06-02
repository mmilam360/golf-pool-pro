'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type ReminderPool = {
  id: string
  name: string
  incompleteCount: number
  activeEntryCount: number
}

export default function RunnerIncompletePicksReminder({ pools }: { pools: ReminderPool[] }) {
  const [dismissed, setDismissed] = useState(true)
  const storageKey = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const poolIds = pools.map(pool => pool.id).sort().join('-')
    return `gpp-runner-incomplete-picks:${today}:${poolIds}`
  }, [pools])

  useEffect(() => {
    if (pools.length === 0) return
    setDismissed(window.localStorage.getItem(storageKey) === 'dismissed')
  }, [pools.length, storageKey])

  if (pools.length === 0 || dismissed) return null

  const totalIncomplete = pools.reduce((sum, pool) => sum + pool.incompleteCount, 0)
  const poolLabel = pools.length === 1 ? pools[0].name : `${pools.length} pools`

  function dismiss() {
    window.localStorage.setItem(storageKey, 'dismissed')
    setDismissed(true)
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl border-2 border-[#123c2f] bg-white shadow-[6px_6px_0_#d8cab0] sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[28rem]" role="status" aria-live="polite">
      <div className="border-b border-[#d8cab0] bg-[#123c2f] px-4 py-3 text-white">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#d7c99f]">Runner reminder</p>
        <p className="mt-1 text-lg font-black leading-tight">{totalIncomplete} incomplete {totalIncomplete === 1 ? 'entry' : 'entries'}</p>
      </div>
      <div className="space-y-3 px-4 py-3">
        <p className="text-sm font-semibold leading-6 text-[#1f2a24]">
          {poolLabel} still {pools.length === 1 ? 'has' : 'have'} players without full picks. We’ll only show this once today.
        </p>
        <ul className="space-y-1 border-y border-[#eadfca] py-2 text-sm font-bold text-[#123c2f]">
          {pools.slice(0, 3).map(pool => (
            <li key={pool.id} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">{pool.name}</span>
              <span className="shrink-0 font-mono text-xs text-[#657168]">{pool.incompleteCount}/{pool.activeEntryCount}</span>
            </li>
          ))}
          {pools.length > 3 ? <li className="text-xs font-black uppercase tracking-[0.1em] text-[#657168]">+ {pools.length - 3} more</li> : null}
        </ul>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={dismiss} className="border border-[#d8cab0] bg-[#fbf7ed] px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-[#657168] hover:bg-white">
            Dismiss today
          </button>
          <Link href="/manage-pools" onClick={dismiss} className="border-2 border-[#123c2f] bg-[#fbf7ed] px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-[#123c2f] hover:bg-[#fff4cf]">
            Review pools
          </Link>
        </div>
      </div>
    </div>
  )
}
