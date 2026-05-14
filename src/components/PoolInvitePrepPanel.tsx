'use client'

import { useMemo, useState } from 'react'

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
  obRuleEnabled: boolean
  obPenaltyStrokes: number
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
  obRuleEnabled,
  obPenaltyStrokes,
}: InvitePrepPanelProps) {
  const [format, setFormat] = useState<'text' | 'email'>('text')
  const [copied, setCopied] = useState(false)
  const missingPickCount = Math.max(entryCount - submittedPickCount, 0)
  const ruleLine = `${plural(pickCount, 'golfer')}, best ${countScores} score${countScores === 1 ? '' : 's'} count${obRuleEnabled ? `, OB rule is ${obPenaltyStrokes} over par` : ''}`

  const copy = useMemo(() => {
    if (format === 'email') {
      return `Subject: ${poolName} golf pool\n\nI'm running ${poolName} for ${tournamentName}.\n\nJoin here: ${joinLink}\nPasscode: ${passcode}\nRules: pick ${plural(pickCount, 'golfer')}; best ${countScores} score${countScores === 1 ? '' : 's'} count${obRuleEnabled ? `; OB rule is ${obPenaltyStrokes} over par` : ''}.\n\nTournament starts ${startDateLabel}. Get your picks in before it locks.`
    }

    return `Golf pool is open: ${poolName} for ${tournamentName}. Join here: ${joinLink} Passcode: ${passcode}. Rules: pick ${pickCount}, best ${countScores} count${obRuleEnabled ? `, OB ${obPenaltyStrokes} over par` : ''}. Locks ${startDateLabel}.`
  }, [countScores, format, joinLink, obPenaltyStrokes, obRuleEnabled, passcode, pickCount, poolName, startDateLabel, tournamentName])

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(copy)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="border-b border-[#eadfca] bg-[#fffdf8] px-4 py-5 sm:px-5">
      <div className="grid gap-4 border-2 border-[#123c2f] bg-white p-4 shadow-[5px_5px_0_#d8cab0] lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a6724]">Invite board</p>
          <h2 className="mt-1 font-display text-2xl font-black text-[#0f2f25]">Fill the pool before it locks.</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div className="border border-[#d8cab0] bg-[#fbf7ed] p-3">
              <p className="font-mono text-2xl font-black text-[#123c2f]">{entryCount}</p>
              <p className="mt-1 font-bold uppercase tracking-[0.08em] text-[#657168]">entries</p>
            </div>
            <div className="border border-[#d8cab0] bg-[#fbf7ed] p-3">
              <p className="font-mono text-2xl font-black text-[#123c2f]">{submittedPickCount}</p>
              <p className="mt-1 font-bold uppercase tracking-[0.08em] text-[#657168]">with picks</p>
            </div>
            <div className="border border-[#d8cab0] bg-[#fbf7ed] p-3">
              <p className="font-mono text-2xl font-black text-[#b21e23]">{missingPickCount}</p>
              <p className="mt-1 font-bold uppercase tracking-[0.08em] text-[#657168]">need picks</p>
            </div>
          </div>
          <p className="mt-3 text-sm font-semibold leading-6 text-[#4f5b52]">Passcode <span className="font-mono font-black text-[#123c2f]">{passcode}</span>. {ruleLine}.</p>
        </div>

        <div className="border border-[#d8cab0] bg-[#fbf7ed] p-3">
          <div className="flex gap-2">
            <button type="button" onClick={() => setFormat('text')} className={`flex-1 border px-3 py-2 text-sm font-black uppercase tracking-[0.08em] ${format === 'text' ? 'border-[#123c2f] bg-[#123c2f] text-white' : 'border-[#d8cab0] bg-white text-[#123c2f]'}`}>Text</button>
            <button type="button" onClick={() => setFormat('email')} className={`flex-1 border px-3 py-2 text-sm font-black uppercase tracking-[0.08em] ${format === 'email' ? 'border-[#123c2f] bg-[#123c2f] text-white' : 'border-[#d8cab0] bg-white text-[#123c2f]'}`}>Email</button>
          </div>
          <textarea readOnly value={copy} className="mt-3 min-h-36 w-full resize-none border-2 border-[#123c2f] bg-white p-3 text-sm font-semibold leading-6 text-[#1f2a24]" />
          <button type="button" onClick={copyInvite} className="mt-3 w-full border-2 border-[#123c2f] bg-[#f3df9c] px-4 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#0f2f25]">
            {copied ? 'Copied' : `Copy ${format}`}
          </button>
        </div>
      </div>
    </div>
  )
}
