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
  const pool = visiblePools[0]

  if (!loaded || !pool) return null

  const copy = buildReminderCopy(pool)
  const playerLabel = plural(pool.incompleteCount, 'player')
  const poolPosition = visiblePools.length > 1 ? `${pools.length - visiblePools.length + 1} of ${pools.length}` : null

  function dismiss(poolId: string) {
    window.localStorage.setItem(storageKeyForPool(dateKey, poolId), 'dismissed')
    setDismissedPoolIds(current => new Set(current).add(poolId))
  }

  async function copyText(reminderPool: ReminderPool) {
    try {
      await navigator.clipboard.writeText(buildReminderCopy(reminderPool))
      setCopiedPoolId(reminderPool.id)
      window.setTimeout(() => setCopiedPoolId(null), 1600)
    } catch {
      setCopiedPoolId(null)
    }
  }

  return (
    <div className="fixed inset-x-3 top-24 z-[90] mx-auto max-w-md sm:inset-x-auto sm:right-5 sm:top-20 sm:w-[26rem]" role="status" aria-live="polite">
      <section className="relative overflow-hidden rounded-[18px] border border-[#123c2f]/20 bg-white shadow-[0_20px_60px_rgba(15,47,37,0.34)] ring-1 ring-black/5">
        <div className="absolute left-0 top-0 h-full w-1.5 bg-[#f3df9c]" />
        <button
          type="button"
          onClick={() => dismiss(pool.id)}
          aria-label="Dismiss picks reminder"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-[#d8cab0] bg-white text-lg font-black leading-none text-[#657168] shadow-sm hover:bg-[#fbf7ed] hover:text-[#123c2f]"
        >
          ×
        </button>

        <div className="space-y-3 px-5 pb-4 pt-4">
          <div className="pr-10">
            <div className="flex flex-wrap items-center gap-2">
              <p className="rounded-full bg-[#b93a32] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white">Picks missing</p>
              {poolPosition ? <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#657168]">{poolPosition}</p> : null}
            </div>
            <h2 className="mt-2 text-lg font-black leading-tight text-[#0f2f25]">{pool.name}</h2>
            <p className="mt-1 text-sm font-bold text-[#657168]">{playerLabel} need{pool.incompleteCount === 1 ? 's' : ''} picks</p>
          </div>

          <div className="rounded-xl border border-[#eadfca] bg-[#fbf7ed] px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8a6724]">Needs picks</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {pool.incompleteEntries.map(entry => (
                <span key={entry.id} className="rounded-full border border-[#d8cab0] bg-white px-2.5 py-1 text-xs font-black text-[#123c2f] shadow-sm">
                  {entry.displayName} <span className="font-mono text-[#657168]">{entry.submittedPickCount}/{entry.requiredPickCount}</span>
                </span>
              ))}
            </div>
          </div>

          <p className="text-sm font-semibold leading-6 text-[#1f2a24]">Copy this for the {pool.name} group chat.</p>

          <div className="max-h-44 overflow-y-auto rounded-xl border border-[#d8cab0] bg-[#fffdf8] p-3 text-sm font-semibold leading-6 text-[#1f2a24] shadow-inner">
            <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{copy}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Link href="/manage-pools" onClick={() => dismiss(pool.id)} className="rounded-lg border border-[#d8cab0] bg-white px-3 py-2 text-center text-xs font-black uppercase tracking-[0.1em] text-[#123c2f] hover:bg-[#eef7ef]">
              Review pools
            </Link>
            <button type="button" onClick={() => copyText(pool)} className="rounded-lg border border-[#123c2f] bg-[#123c2f] px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-white shadow-sm hover:bg-[#0f2f25]">
              {copiedPoolId === pool.id ? 'Copied' : 'Copy text'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
