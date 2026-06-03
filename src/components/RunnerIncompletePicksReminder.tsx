'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type ReminderEntry = {
  id: string
  displayName: string
  submittedPickCount: number
  requiredPickCount: number
}

type ReminderPool = {
  id: string
  name: string
  incompleteCount: number
  activeEntryCount: number
  incompleteEntries: ReminderEntry[]
}

function plural(value: number, singular: string, pluralWord = `${singular}s`) {
  return `${value} ${value === 1 ? singular : pluralWord}`
}

function buildReminderCopy(pool: ReminderPool) {
  const lines = [
    'Heads up — picks lock automatically before the first tee time on tournament day.',
    '',
    `${pool.name} still needs picks from:`,
  ]

  pool.incompleteEntries.forEach(entry => {
    lines.push(`- ${entry.displayName}: ${entry.submittedPickCount}/${entry.requiredPickCount} picks in`)
  })

  lines.push('', 'Get your picks in when you get a chance.')
  return lines.join('\n')
}

function storageKeyForPool(dateKey: string, poolId: string) {
  return `gpp-runner-incomplete-picks:${dateKey}:${poolId}`
}

export default function RunnerIncompletePicksReminder({ pools }: { pools: ReminderPool[] }) {
  const [loaded, setLoaded] = useState(false)
  const [dismissedPoolIds, setDismissedPoolIds] = useState<Set<string>>(new Set())
  const [copiedPoolId, setCopiedPoolId] = useState<string | null>(null)
  const dateKey = useMemo(() => new Date().toISOString().slice(0, 10), [])

  useEffect(() => {
    if (pools.length === 0) {
      setLoaded(true)
      return
    }

    setDismissedPoolIds(new Set(
      pools
        .filter(pool => window.localStorage.getItem(storageKeyForPool(dateKey, pool.id)) === 'dismissed')
        .map(pool => pool.id)
    ))
    setLoaded(true)
  }, [dateKey, pools])

  const visiblePools = pools.filter(pool => !dismissedPoolIds.has(pool.id))

  if (!loaded || visiblePools.length === 0) return null

  function dismiss(poolId: string) {
    window.localStorage.setItem(storageKeyForPool(dateKey, poolId), 'dismissed')
    setDismissedPoolIds(current => new Set(current).add(poolId))
  }

  async function copyText(pool: ReminderPool) {
    try {
      await navigator.clipboard.writeText(buildReminderCopy(pool))
      setCopiedPoolId(pool.id)
      window.setTimeout(() => setCopiedPoolId(null), 1600)
    } catch {
      setCopiedPoolId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#0f2f25]/45 p-3 backdrop-blur-[1px] sm:items-end sm:justify-end sm:p-5" role="status" aria-live="polite">
      <div className="flex max-h-[86vh] w-full max-w-xl flex-col gap-3 overflow-y-auto sm:w-[30rem]">
        {visiblePools.map(pool => {
          const copy = buildReminderCopy(pool)
          const playerLabel = plural(pool.incompleteCount, 'player')
          return (
            <section key={pool.id} className="border-4 border-[#123c2f] bg-white shadow-[10px_10px_0_rgba(15,47,37,0.45)] ring-4 ring-white">
              <div className="border-b-2 border-[#d8cab0] bg-[#123c2f] px-4 py-3 text-white">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#d7c99f]">Picks still missing</p>
                <p className="mt-1 font-display text-2xl font-black leading-none text-white">{pool.name}</p>
                <p className="mt-2 text-base font-black leading-tight">{playerLabel} need{pool.incompleteCount === 1 ? 's' : ''} picks</p>
              </div>
              <div className="space-y-3 px-4 py-4">
                <p className="text-sm font-semibold leading-6 text-[#1f2a24]">
                  Copy this for the {pool.name} group chat.
                </p>
                <div className="max-h-72 overflow-y-auto border-2 border-[#123c2f] bg-[#fbf7ed] p-3 text-sm font-semibold leading-6 text-[#1f2a24] shadow-inner">
                  <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{copy}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                  <button type="button" onClick={() => dismiss(pool.id)} className="border border-[#d8cab0] bg-[#fbf7ed] px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-[#657168] hover:bg-white">
                    Dismiss
                  </button>
                  <Link href="/manage-pools" onClick={() => dismiss(pool.id)} className="border border-[#123c2f] bg-white px-3 py-2 text-center text-xs font-black uppercase tracking-[0.1em] text-[#123c2f] hover:bg-[#eef7ef]">
                    Review pools
                  </Link>
                  <button type="button" onClick={() => copyText(pool)} className="col-span-2 border-2 border-[#123c2f] bg-[#f3df9c] px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-[#0f2f25] hover:bg-[#f8e9b2] sm:col-span-1">
                    {copiedPoolId === pool.id ? 'Copied' : 'Copy text'}
                  </button>
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
