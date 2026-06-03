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

function buildReminderCopy(pools: ReminderPool[]) {
  const lines = [
    'Heads up — picks lock automatically before the first tee time on tournament day.',
    '',
  ]

  pools.forEach((pool, poolIndex) => {
    if (poolIndex > 0) lines.push('')
    lines.push(`${pool.name} still needs picks from:`)
    pool.incompleteEntries.forEach(entry => {
      lines.push(`- ${entry.displayName}: ${entry.submittedPickCount}/${entry.requiredPickCount} picks in`)
    })
  })

  lines.push('', 'Get your picks in when you get a chance.')
  return lines.join('\n')
}

export default function RunnerIncompletePicksReminder({ pools }: { pools: ReminderPool[] }) {
  const [dismissed, setDismissed] = useState(true)
  const [copied, setCopied] = useState(false)
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
  const copy = buildReminderCopy(pools)

  function dismiss() {
    window.localStorage.setItem(storageKey, 'dismissed')
    setDismissed(true)
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(copy)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl border-2 border-[#123c2f] bg-white shadow-[6px_6px_0_#d8cab0] sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[30rem]" role="status" aria-live="polite">
      <div className="border-b border-[#d8cab0] bg-[#123c2f] px-4 py-3 text-white">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#d7c99f]">Picks still missing</p>
        <p className="mt-1 text-lg font-black leading-tight">{plural(totalIncomplete, 'player')} need{totalIncomplete === 1 ? 's' : ''} picks</p>
      </div>
      <div className="space-y-3 px-4 py-3">
        <p className="text-sm font-semibold leading-6 text-[#1f2a24]">
          Copy this if you want to text the group.
        </p>
        <div className="border-2 border-[#123c2f] bg-[#fbf7ed] p-3 text-sm font-semibold leading-6 text-[#1f2a24]">
          <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{copy}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={dismiss} className="border border-[#d8cab0] bg-[#fbf7ed] px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-[#657168] hover:bg-white">
            Dismiss today
          </button>
          <Link href="/manage-pools" onClick={dismiss} className="border border-[#123c2f] bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-[#123c2f] hover:bg-[#eef7ef]">
            Review pools
          </Link>
          <button type="button" onClick={copyText} className="border-2 border-[#123c2f] bg-[#f3df9c] px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-[#0f2f25] hover:bg-[#f8e9b2]">
            {copied ? 'Copied' : 'Copy text'}
          </button>
        </div>
      </div>
    </div>
  )
}
