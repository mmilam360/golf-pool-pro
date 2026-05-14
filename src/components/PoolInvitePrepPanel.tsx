'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'

type InvitePrepPanelProps = {
  poolName: string
  tournamentName: string
  startDateLabel: string
  entryCount: number
  submittedPickCount: number
  passcode: string
  joinLink: string
  pickCount: number
  countScores: number
  previousPlayerInviteNode?: ReactNode
}

function plural(value: number, singular: string, pluralWord = `${singular}s`) {
  return `${value} ${value === 1 ? singular : pluralWord}`
}

export function PoolInvitePrepPanel({
  poolName,
  tournamentName,
  startDateLabel,
  entryCount,
  submittedPickCount,
  passcode,
  joinLink,
  pickCount,
  countScores,
  previousPlayerInviteNode,
}: InvitePrepPanelProps) {
  const [format, setFormat] = useState<'text' | 'email'>('text')
  const [copied, setCopied] = useState<'invite' | 'passcode' | 'link' | null>(null)
  const missingPickCount = Math.max(entryCount - submittedPickCount, 0)
  const lockLine = `Picks lock before the first tee time on tournament day${startDateLabel !== 'Date TBA' ? ` (${startDateLabel})` : ''}.`

  const copy = useMemo(() => {
    if (format === 'email') {
      return `Subject: ${poolName} golf pool\n\nI set up the ${poolName} pool for the ${tournamentName}.\n\nJoin here:\n${joinLink}\n\nPasscode: ${passcode}\n\nRules are simple: pick ${plural(pickCount, 'golfer')}, best ${countScores} score${countScores === 1 ? '' : 's'} count. ${lockLine}\n\nGet your picks in when you get a chance.`
    }

    return `${poolName} golf pool is open for the ${tournamentName}.\n\nJoin: ${joinLink}\nPasscode: ${passcode}\n\nPick ${pickCount} golfers. Best ${countScores} score${countScores === 1 ? '' : 's'} count. ${lockLine}`
  }, [countScores, format, joinLink, lockLine, passcode, pickCount, poolName, tournamentName])
  const copyRows = Math.max(8, copy.split('\n').reduce((rows, line) => rows + Math.max(1, Math.ceil(line.length / 42)), 0) + 1)

  async function copyValue(value: string, type: 'invite' | 'passcode' | 'link') {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(type)
      window.setTimeout(() => setCopied(null), 1600)
    } catch {
      setCopied(null)
    }
  }

  return (
    <div className="border-b border-[#eadfca] bg-[#fffdf8] px-4 py-5 sm:px-5">
      <div className="grid gap-4 border-2 border-[#123c2f] bg-white p-4 shadow-[5px_5px_0_#d8cab0] lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a6724]">Invite board</p>
          <h2 className="mt-1 font-display text-2xl font-black text-[#0f2f25]">Fill the pool before it locks.</h2>

          <div className="mt-3 inline-flex flex-wrap items-center gap-x-2 gap-y-1 border border-[#d8cab0] bg-[#fbf7ed] px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#657168]">
            <span><span className="font-mono text-[#123c2f]">{entryCount}</span> {entryCount === 1 ? 'entry' : 'entries'}</span>
            <span className="text-[#d8cab0]">/</span>
            <span><span className="font-mono text-[#123c2f]">{submittedPickCount}</span> picks in</span>
            <span className="text-[#d8cab0]">/</span>
            <span><span className="font-mono text-[#b21e23]">{missingPickCount}</span> need picks</span>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between gap-3 border border-[#d8cab0] bg-white px-3 py-2">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#657168]">Passcode</p>
                <p className="font-mono text-base font-black tracking-[0.08em] text-[#123c2f]">{passcode}</p>
              </div>
              <button type="button" onClick={() => copyValue(passcode, 'passcode')} className="shrink-0 border border-[#123c2f] bg-[#fbf7ed] px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#123c2f]">
                {copied === 'passcode' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="flex items-center justify-between gap-3 border border-[#d8cab0] bg-white px-3 py-2">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#657168]">Join link</p>
                <p className="truncate font-mono text-xs font-semibold text-[#1f2a24]">{joinLink}</p>
              </div>
              <button type="button" onClick={() => copyValue(joinLink, 'link')} className="shrink-0 border border-[#123c2f] bg-[#fbf7ed] px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#123c2f]">
                {copied === 'link' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {previousPlayerInviteNode}
        </div>

        <div className="border border-[#d8cab0] bg-[#fbf7ed] p-3">
          <div className="flex gap-2">
            <button type="button" onClick={() => setFormat('text')} className={`flex-1 border px-3 py-2 text-sm font-black uppercase tracking-[0.08em] ${format === 'text' ? 'border-[#123c2f] bg-[#123c2f] text-white' : 'border-[#d8cab0] bg-white text-[#123c2f]'}`}>Text</button>
            <button type="button" onClick={() => setFormat('email')} className={`flex-1 border px-3 py-2 text-sm font-black uppercase tracking-[0.08em] ${format === 'email' ? 'border-[#123c2f] bg-[#123c2f] text-white' : 'border-[#d8cab0] bg-white text-[#123c2f]'}`}>Email</button>
          </div>
          <textarea readOnly value={copy} rows={copyRows} className="mt-3 w-full resize-none overflow-hidden border-2 border-[#123c2f] bg-white p-3 text-sm font-semibold leading-6 text-[#1f2a24]" />
          <button type="button" onClick={() => copyValue(copy, 'invite')} className="mt-3 w-full border-2 border-[#123c2f] bg-[#f3df9c] px-4 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#0f2f25]">
            {copied === 'invite' ? 'Copied' : `Copy ${format}`}
          </button>
        </div>
      </div>
    </div>
  )
}
