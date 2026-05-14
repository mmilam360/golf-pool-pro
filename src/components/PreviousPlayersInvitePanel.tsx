'use client'

import { useMemo, useState, useTransition } from 'react'
import { sendPoolInvites } from '@/app/(app)/pool-invites/actions'

type PreviousPlayerCandidate = {
  userId: string
  displayName: string
}

type InviteSummary = {
  pending: number
  accepted: number
  declined: number
}

export function PreviousPlayersInvitePanel({
  poolId,
  candidates,
  summary,
}: {
  poolId: string
  candidates: PreviousPlayerCandidate[]
  summary: InviteSummary
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(() => new Set(candidates.map(candidate => candidate.userId)))
  const [isPending, startTransition] = useTransition()
  const selectedCount = selected.size
  const summaryLine = useMemo(() => {
    const parts = []
    if (summary.pending) parts.push(`${summary.pending} pending`)
    if (summary.accepted) parts.push(`${summary.accepted} accepted`)
    if (summary.declined) parts.push(`${summary.declined} declined`)
    return parts.join(' · ')
  }, [summary])

  function toggle(userId: string) {
    setSelected(current => {
      const next = new Set(current)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(candidates.map(candidate => candidate.userId)))
  }

  function clearAll() {
    setSelected(new Set())
  }

  function submitInvites() {
    const formData = new FormData()
    formData.set('poolId', poolId)
    Array.from(selected).forEach(userId => formData.append('invitedUserId', userId))
    startTransition(async () => {
      await sendPoolInvites(formData)
      setOpen(false)
      clearAll()
    })
  }

  return (
    <div className="mt-4 border border-[#d8cab0] bg-[#fbf7ed] p-3">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="flex w-full items-center justify-between gap-3 text-left font-black text-[#123c2f]"
      >
        <span>Invite previous players</span>
        <span className="font-mono text-sm">{open ? '−' : '+'}</span>
      </button>
      {summaryLine ? <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#657168]">{summaryLine}</p> : null}

      {open ? (
        <div className="mt-3 space-y-3">
          {candidates.length ? (
            <>
              <div className="flex gap-2">
                <button type="button" onClick={selectAll} className="border border-[#123c2f] bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#123c2f]">Select all</button>
                <button type="button" onClick={clearAll} className="border border-[#d8cab0] bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#657168]">Clear</button>
              </div>
              <div className="max-h-52 overflow-auto border border-[#d8cab0] bg-white">
                {candidates.map(candidate => (
                  <label key={candidate.userId} className="flex cursor-pointer items-center gap-3 border-b border-[#eadfca] px-3 py-3 text-sm font-bold text-[#1f2a24] last:border-b-0">
                    <input
                      type="checkbox"
                      checked={selected.has(candidate.userId)}
                      onChange={() => toggle(candidate.userId)}
                      className="h-4 w-4 accent-[#123c2f]"
                    />
                    <span>{candidate.displayName}</span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={submitInvites}
                disabled={isPending || selectedCount === 0}
                className="w-full border-2 border-[#123c2f] bg-[#123c2f] px-4 py-3 text-sm font-black uppercase tracking-[0.08em] text-white disabled:opacity-50"
              >
                {isPending ? 'Sending...' : `Send ${selectedCount} invite${selectedCount === 1 ? '' : 's'}`}
              </button>
            </>
          ) : (
            <p className="text-sm font-semibold leading-6 text-[#657168]">No eligible previous players right now. Anyone already in this pool or already invited is hidden.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}
