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
  ]

  pool.incompleteEntries.forEach(entry => {
    lines.push(`${entry.displayName}: ${entry.submittedPickCount}/${entry.requiredPickCount} picks in`)
  })

  lines.push('', 'Get your picks in when you get a chance.')
  return lines.join('\n')
}

function storageKeyForPool(dateKey: string, poolId: string) {
  return `gpp-runner-incomplete-picks:v2:${dateKey}:${poolId}`
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
    <div className="fixed inset-0 z-[300] flex items-start justify-center bg-[#0f2f25]/65 px-4 py-24 backdrop-blur-sm sm:items-end sm:justify-end sm:p-5" role="status" aria-live="polite">
      <div className="flex max-h-[82vh] w-full max-w-md flex-col gap-3 overflow-y-auto sm:w-[27rem]">
        {visiblePools.map(pool => {
          const copy = buildReminderCopy(pool)
          const playerLabel = plural(pool.incompleteCount, 'player')

          return (
            <section key={pool.id} className="relative border border-[#d8cab0] bg-white shadow-[0_24px_80px_rgba(15,47,37,0.48)] ring-4 ring-white/90">
              <button
                type="button"
                onClick={() => dismiss(pool.id)}
                aria-label="Dismiss picks reminder"
                className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center border border-[#d8cab0] bg-[#fbf7ed] text-xl font-black leading-none text-[#657168] hover:bg-white hover:text-[#123c2f]"
              >
                ×
              </button>

              <div className="space-y-4 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
                <div className="pr-10">
                  <p className="inline-flex border border-[#b93a32] bg-[#b93a32] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white">
                    Picks missing
                  </p>
                  <h2 className="mt-3 text-2xl font-black leading-tight text-[#0f2f25]">{pool.name}</h2>
                  <p className="mt-1 text-sm font-bold leading-5 text-[#657168]">
                    {pool.incompleteCount === 1 ? '1 player still needs picks.' : `${pool.incompleteCount} players still need picks.`}
                  </p>
                </div>

                <div className="border border-[#eadfca] bg-[#fbf7ed] px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8a6724]">Needs picks</p>
                    <p className="font-mono text-xs font-black text-[#657168]">{playerLabel}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pool.incompleteEntries.map(entry => (
                      <span key={entry.id} className="border border-[#d8cab0] bg-white px-2.5 py-1 text-xs font-black text-[#123c2f]">
                        {entry.displayName} <span className="font-mono text-[#657168]">{entry.submittedPickCount}/{entry.requiredPickCount}</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-bold leading-5 text-[#1f2a24]">Copy this for the {pool.name} group chat:</p>
                  <div className="mt-2 max-h-52 overflow-y-auto border border-[#d8cab0] bg-[#fffdf8] p-3 text-sm font-semibold leading-6 text-[#1f2a24]">
                    <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{copy}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => dismiss(pool.id)} className="border border-[#d8cab0] bg-[#fbf7ed] px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-[#657168] hover:bg-white">
                    Dismiss
                  </button>
                  <Link href="/manage-pools" onClick={() => dismiss(pool.id)} className="border border-[#123c2f] bg-white px-3 py-2 text-center text-xs font-black uppercase tracking-[0.1em] text-[#123c2f] hover:bg-[#eef7ef]">
                    Review pools
                  </Link>
                  <button type="button" onClick={() => copyText(pool)} className="col-span-2 border-2 border-[#123c2f] bg-[#f3df9c] px-3 py-3 text-xs font-black uppercase tracking-[0.1em] text-[#0f2f25] hover:bg-[#f8e9b2]">
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
