'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { scoreEntry, rankEntries, type ScoredEntry } from '@/lib/scoring'
import type { GolfPlayer } from '@/lib/golf-api'

interface Props {
  pool: any
  tournament: any
  entries: any[]
  myEntry: any | null
  isOwner: boolean
  userId: string
}

type Tab = 'leaderboard' | 'my-team' | 'admin'

function formatScore(score: number | null) {
  if (score === null) return '—'
  if (score === 0) return 'E'
  return score > 0 ? `+${score}` : String(score)
}

function scoreClass(score: number | null) {
  if (score === null) return 'text-stone-400'
  return score < 0 ? 'text-[#b21e23]' : 'text-[#111]'
}

function shortName(name: string) {
  const clean = name.replace(/^OB Stand-in #/, 'OB ')
  if (clean.startsWith('OB ')) return clean
  const parts = clean.split(' ').filter(Boolean)
  return parts.length > 1 ? parts[parts.length - 1] : clean
}

function thruLabel(thru?: string) {
  if (!thru) return '—'
  const value = String(thru).toUpperCase()
  return value === 'F' ? 'F' : `THRU ${value}`
}

function CopyIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M7 7V4.75C7 3.78 7.78 3 8.75 3h6.5C16.22 3 17 3.78 17 4.75v6.5c0 .97-.78 1.75-1.75 1.75H13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="square" />
      <path d="M3 8.75C3 7.78 3.78 7 4.75 7h6.5c.97 0 1.75.78 1.75 1.75v6.5c0 .97-.78 1.75-1.75 1.75h-6.5C3.78 17 3 16.22 3 15.25v-6.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="square" />
    </svg>
  )
}

export default function PoolView({ pool, tournament, entries: initialEntries, myEntry: initialMyEntry, isOwner, userId }: Props) {
  const [tab, setTab] = useState<Tab>(initialMyEntry?.golfer_picks?.length ? 'leaderboard' : 'my-team')
  const [entries, setEntries] = useState(initialEntries)
  const [myEntry, setMyEntry] = useState(initialMyEntry)
  const [leaderboard, setLeaderboard] = useState<GolfPlayer[]>([])
  const [field, setField] = useState<GolfPlayer[]>([])
  const [myPicks, setMyPicks] = useState<string[]>(initialMyEntry?.golfer_picks || [])
  const [loadingScores, setLoadingScores] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [emailRecipients, setEmailRecipients] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  const [removeReason, setRemoveReason] = useState('')
  const supabase = createClient()

  const activeEntries = entries.filter(e => !e.is_removed)
  const isLocked = pool.is_locked
  const scoringIsLive = tournament?.status === 'live' || tournament?.status === 'completed'
  const canInvitePlayers = !isLocked && !scoringIsLive

  useEffect(() => {
    setInviteUrl(`${window.location.origin}/pool/join?code=${pool.passcode}`)
  }, [pool.passcode])

  // Fetch live leaderboard
  const fetchScores = useCallback(async () => {
    if (!tournament?.external_id) return
    setLoadingScores(true)
    try {
      const res = await fetch(`/api/tournaments/leaderboard?id=${tournament.external_id}`)
      if (res.ok) {
        const data = await res.json()
        const liveLeaderboard = data.leaderboard || []
        if (liveLeaderboard.length > 0) {
          setLeaderboard(liveLeaderboard)
          setField(liveLeaderboard)
        }
      }
    } catch {}
    setLoadingScores(false)
  }, [tournament?.external_id])

  useEffect(() => {
    // Load field from tournament data if available
    if (tournament?.field_json) {
      setField(tournament.field_json as GolfPlayer[])
    }
    if (scoringIsLive && tournament?.leaderboard_json) {
      setLeaderboard(tournament.leaderboard_json as GolfPlayer[])
    }
    fetchScores()
    const interval = setInterval(fetchScores, 60000) // refresh every minute
    return () => clearInterval(interval)
  }, [fetchScores, tournament, scoringIsLive])

  // Save picks
  async function savePicks() {
    if (!myEntry) return
    setSaving(true)
    const { error } = await supabase
      .from('gpp_entries')
      .update({ golfer_picks: myPicks })
      .eq('id', myEntry.id)
    if (!error) {
      setMyEntry({ ...myEntry, golfer_picks: myPicks })
      setStatusMessage('Picks saved.')
      setTimeout(() => setStatusMessage(''), 2500)
    }
    setSaving(false)
  }

  function copyToClipboard(value: string, message: string) {
    navigator.clipboard?.writeText(value)
    setStatusMessage(message)
    setTimeout(() => setStatusMessage(''), 2500)
  }

  function copyInviteLink() {
    copyToClipboard(inviteUrl || `${window.location.origin}/pool/join?code=${pool.passcode}`, 'Invite link copied.')
  }

  function copyInviteCode() {
    copyToClipboard(pool.passcode, 'Invite code copied.')
  }

  async function importCsvEmails(file: File | undefined) {
    if (!file) return
    const text = await file.text()
    const found = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []
    if (found.length === 0) {
      setStatusMessage('No email addresses found in that CSV.')
      return
    }

    const existing = emailRecipients.split(/[\s,;]+/).map(email => email.trim()).filter(Boolean)
    const merged = Array.from(new Set([...existing, ...found].map(email => email.toLowerCase())))
    setEmailRecipients(merged.join(', '))
    setStatusMessage(`${found.length} ${found.length === 1 ? 'email' : 'emails'} found in CSV.`)
    setTimeout(() => setStatusMessage(''), 3000)
  }

  async function sendInvites() {
    const recipients = emailRecipients.split(/[\s,;]+/).map(email => email.trim()).filter(Boolean)
    if (recipients.length === 0) {
      setStatusMessage('Add at least one email address.')
      return
    }

    setEmailSending(true)
    const inviteUrl = `${window.location.origin}/pool/join?code=${pool.passcode}`
    const res = await fetch('/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        poolId: pool.id,
        recipients,
        subject: `Join ${pool.name}`,
        body: `You're invited to join ${pool.name}.\n\nUse code ${pool.passcode} or open this link:\n${inviteUrl}`,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setEmailSending(false)

    if (!res.ok) {
      setStatusMessage(data.error === 'Email service not configured'
        ? 'Email is wired up, but RESEND_API_KEY is missing in Vercel.'
        : data.error || 'Email failed.')
      return
    }

    setEmailRecipients('')
    setStatusMessage(`Invite sent to ${recipients.length} ${recipients.length === 1 ? 'person' : 'people'}.`)
    setTimeout(() => setStatusMessage(''), 3500)
  }

  // Toggle golfer in picks
  function togglePick(name: string) {
    if (isLocked) return
    setMyPicks(prev => {
      if (prev.includes(name)) return prev.filter(n => n !== name)
      if (prev.length >= pool.pick_count) return prev
      return [...prev, name]
    })
  }

  // Remove entry (admin)
  async function removeEntry(entryId: string) {
    const { error } = await supabase
      .from('gpp_entries')
      .update({ is_removed: true, removed_reason: removeReason, removed_at: new Date().toISOString() })
      .eq('id', entryId)
    if (!error) {
      setEntries(entries.map(e => e.id === entryId ? { ...e, is_removed: true, removed_reason: removeReason } : e))
      setRemoveTarget(null); setRemoveReason('')
    }
  }

  // Lock/unlock pool (admin)
  async function setPoolLock(locked: boolean) {
    const { error } = await supabase
      .from('gpp_pools')
      .update({ is_locked: locked })
      .eq('id', pool.id)
    if (!error) {
      pool.is_locked = locked
      setStatusMessage(locked ? 'Pool locked. Picks are closed.' : 'Pool unlocked. Entries and picks are open.')
      window.location.reload()
    }
  }

  // Compute scored entries
  const scoredEntries: ScoredEntry[] = rankEntries(
    activeEntries.map(entry => ({
      ...scoreEntry(
        (entry.golfer_picks as string[]) || [],
        scoringIsLive ? leaderboard : [],
        { countScores: pool.count_scores, obRuleEnabled: pool.ob_rule_enabled, obPenaltyStrokes: pool.ob_penalty_strokes }
      ),
      entryId: entry.id,
      displayName: entry.display_name,
    }))
  )

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{pool.name}</h1>
        <p className="text-stone-600 mt-1">{tournament?.name || 'Tournament'} at {tournament?.course || 'TBD'}</p>
        <div className="flex items-center gap-4 mt-2 text-sm">
          <span className="text-stone-600">Passcode: <span className="text-emerald-700 font-mono font-semibold">{pool.passcode}</span></span>
          <span className="text-stone-600">{activeEntries.length} {activeEntries.length === 1 ? 'entry' : 'entries'}</span>
          <span className="text-stone-600">Field: {field.length || ((tournament?.field_json as GolfPlayer[] | undefined)?.length || 0)} golfers</span>
          {isLocked && <span className="text-amber-700">Picks locked</span>}
          {pool.is_completed && <span className="text-emerald-700">Final results</span>}
        </div>
      </div>

      {statusMessage && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{statusMessage}</div>}

      {canInvitePlayers && <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
        <div className="mb-3">
          <p className="text-sm font-semibold text-emerald-950">Invite players</p>
          <p className="text-sm text-stone-700">Send the code or the direct join link.</p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white px-3 py-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">Code</p>
              <p className="font-mono text-base font-semibold tracking-[0.08em] text-emerald-900">{pool.passcode}</p>
            </div>
            <button onClick={copyInviteCode} className="shrink-0 rounded-md border border-stone-300 p-2 text-emerald-900 hover:bg-emerald-50" aria-label="Copy invite code">
              <CopyIcon />
            </button>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white px-3 py-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">Link</p>
              <p className="truncate font-mono text-xs text-stone-900">{inviteUrl || `/pool/join?code=${pool.passcode}`}</p>
            </div>
            <button onClick={copyInviteLink} className="shrink-0 rounded-md border border-stone-300 p-2 text-emerald-900 hover:bg-emerald-50" aria-label="Copy invite link">
              <CopyIcon />
            </button>
          </div>
        </div>
        {isOwner && (
          <div className="mt-4 border-t border-amber-200 pt-4">
            <label className="block text-sm font-medium text-stone-700 mb-2">Email invites</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={emailRecipients}
                onChange={e => setEmailRecipients(e.target.value)}
                placeholder="Emails separated by commas"
                className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
              <label className="cursor-pointer rounded-lg border border-stone-300 bg-white px-4 py-2 text-center text-sm font-semibold text-stone-800 shadow-sm hover:bg-stone-50">
                Import CSV
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="sr-only"
                  onChange={async e => {
                    await importCsvEmails(e.target.files?.[0])
                    e.currentTarget.value = ''
                  }}
                />
              </label>
              <button onClick={sendInvites} disabled={emailSending} className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-stone-800 disabled:opacity-50">
                {emailSending ? 'Sending...' : 'Send invites'}
              </button>
            </div>
          </div>
        )}
      </div>}
      <div className="flex gap-1 mb-6 bg-stone-100 rounded-lg p-1 inline-flex border border-stone-200">
        {(['leaderboard', 'my-team', ...(isOwner ? ['admin'] as Tab[] : [])] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t ? 'bg-white text-emerald-900 shadow-sm' : 'text-stone-600 hover:text-emerald-800'
            }`}>
            {t === 'leaderboard' ? 'Leaderboard' : t === 'my-team' ? 'My Team' : 'Admin'}
          </button>
        ))}
      </div>

      {/* Leaderboard Tab */}
      {tab === 'leaderboard' && (
        <div>
          {loadingScores && <p className="text-stone-500 text-sm mb-4">Loading scores...</p>}
          {scoredEntries.length === 0 ? (
            <div className="bg-white rounded-xl p-8 border border-stone-200 text-center">
              <p className="text-stone-600">No entries yet. Share passcode <span className="text-emerald-700 font-mono">{pool.passcode}</span></p>
            </div>
          ) : (
            <>
            <div
              className="relative pr-[14px] pb-[10px]"
              style={{ fontFamily: 'Arial Narrow, Arial, sans-serif' }}
            >
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[#00452f]"
                style={{ clipPath: 'polygon(calc(100% - 14px) 0, 100% 10px, 100% 100%, calc(100% - 14px) calc(100% - 10px))' }}
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[#003622]"
                style={{ clipPath: 'polygon(0 calc(100% - 10px), 14px 100%, 100% 100%, calc(100% - 14px) calc(100% - 10px))' }}
              />
              <div className="relative z-10 border-[10px] border-[#005b3c] bg-[#005b3c] md:border-[16px]">
              <div className="border-2 border-[#111] bg-[#f7f7f2] text-center shadow-[inset_0_2px_0_rgba(255,255,255,0.45),inset_0_-2px_0_rgba(0,0,0,0.08),6px_6px_0_rgba(0,0,0,0.18)]">
                <div className="border-b-2 border-[#111] px-3 py-2">
                  <p className="text-2xl font-black uppercase leading-none tracking-[0.24em] text-[#111] sm:text-3xl">Leaders</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#005b3c] sm:text-xs">{pool.name}</p>
                </div>
                <p className="border-b border-[#111] bg-[#efeee6] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#111]">
                  Top {pool.count_scores} scores to par counting · {scoringIsLive ? 'Live board' : 'Waiting for scoring'}
                </p>
                <div className="bg-[#f7f7f2] lg:hidden">
                  {scoredEntries.map((entry, entryIndex) => {
                    const isMe = entry.entryId === myEntry?.id
                    const countingPicks = entry.pickScores.filter(pick => pick.counted).slice(0, pool.count_scores)
                    return (
                      <details key={entry.entryId} open={entryIndex === 0} className="group border-b-2 border-[#111]">
                        <summary className="grid cursor-pointer list-none grid-cols-[44px_1fr_74px_20px] items-center gap-2 bg-[#f7f7f2] px-2 py-2 text-left [&::-webkit-details-marker]:hidden">
                          <div className="text-center text-xl font-black text-[#b21e23]">{entry.rank || '—'}</div>
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-1.5">
                              {isMe && <span aria-label="Your entry" className="h-2 w-2 shrink-0 rounded-full bg-[#005b3c]" />}
                              <span className="truncate text-sm font-black uppercase tracking-[0.04em] text-[#111]">{entry.displayName}</span>
                            </div>
                            {(!scoringIsLive || entry.obStandIns > 0) && (
                              <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#555]">
                                {scoringIsLive ? <span className="text-[#b21e23]">{entry.obStandIns} OB</span> : 'Waiting'}
                              </div>
                            )}
                          </div>
                          <div className={`text-right text-2xl font-black ${scoreClass(entry.totalScore)}`}>{formatScore(entry.totalScore)}</div>
                          <div className="flex items-center justify-center text-[#111]">
                            <svg className="h-4 w-4 group-open:hidden" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" />
                            </svg>
                            <svg className="hidden h-4 w-4 group-open:block" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                              <path d="M4 10l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" />
                            </svg>
                            <span className="sr-only">Toggle entry</span>
                          </div>
                        </summary>
                        <div className="grid grid-cols-4 border-t border-[#111] bg-[#fbfbf5]">
                          {Array.from({ length: pool.count_scores }, (_, i) => {
                            const pick = countingPicks[i]
                            return (
                              <div key={i} className="border-r border-t border-[#111] px-1 py-2 text-center [&:nth-child(4n)]:border-r-0">
                                <div className="text-[8px] font-black uppercase tracking-[0.12em] text-[#555]">G{i + 1}</div>
                                <div className={`mt-0.5 text-lg font-black leading-none ${scoreClass(pick?.scoreToPar ?? null)}`}>{pick ? formatScore(pick.scoreToPar) : '—'}</div>
                                <div className="mt-1 truncate text-[10px] font-black uppercase leading-none tracking-[0.02em] text-[#111]">{pick ? shortName(pick.name) : '—'}</div>
                                <div className="mt-1 text-[8px] font-black uppercase tracking-[0.06em] text-[#555]">{pick ? (pick.isObStandIn ? 'OB' : thruLabel(pick.thru)) : '—'}</div>
                              </div>
                            )
                          })}
                        </div>
                      </details>
                    )
                  })}
                </div>
                <div className="hidden bg-[#f7f7f2] lg:block">
                  <table className="w-full table-fixed border-collapse text-[11px] text-[#111]">
                    <thead>
                      <tr className="bg-[#f7f7f2] text-[10px] font-black uppercase tracking-[0.12em] text-[#111]">
                        <th className="w-[4%] border-b-2 border-r-2 border-[#111] bg-[#f7f7f2] px-1 py-2 text-center">Rank</th>
                        <th className="w-[14%] border-b-2 border-r-2 border-[#111] bg-[#f7f7f2] px-2 py-2 text-left">Entry</th>
                        {Array.from({ length: pool.count_scores }, (_, i) => (
                          <th key={i} className="w-[8%] border-b-2 border-r border-[#111] px-1 py-2 text-center">G{i + 1}</th>
                        ))}
                        <th className="w-[10%] border-b-2 border-r-2 border-[#111] px-1 py-2 text-center">Other</th>
                        <th className="w-[8%] border-b-2 border-[#111] px-1 py-2 text-center">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scoredEntries.map(entry => {
                        const isMe = entry.entryId === myEntry?.id
                        const countingPicks = entry.pickScores.filter(pick => pick.counted).slice(0, pool.count_scores)
                        const otherPicks = entry.pickScores.filter(pick => !pick.counted)
                        return (
                          <tr key={entry.entryId} className="bg-[#f7f7f2]">
                            <td className="border-b border-r-2 border-[#111] bg-[#f7f7f2] px-1 py-2 text-center text-lg font-black text-[#b21e23]">
                              {entry.rank || '—'}
                            </td>
                            <td className="border-b border-r-2 border-[#111] bg-[#f7f7f2] px-2 py-2 text-left">
                              <div className="flex min-w-0 items-center gap-1.5">
                                {isMe && <span aria-label="Your entry" className="h-2 w-2 shrink-0 rounded-full bg-[#005b3c]" />}
                                <span className="truncate font-black uppercase tracking-[0.04em] text-[#111]" title={entry.displayName}>{entry.displayName}</span>
                              </div>
                              {(!scoringIsLive || entry.obStandIns > 0) && (
                                <div className="mt-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-[#555]">
                                  {scoringIsLive ? <span className="text-[#b21e23]">{entry.obStandIns} OB</span> : 'Waiting'}
                                </div>
                              )}
                            </td>
                            {Array.from({ length: pool.count_scores }, (_, i) => {
                              const pick = countingPicks[i]
                              return (
                                <td key={i} title={pick?.name || ''} className="border-b border-r border-[#111] bg-[#fbfbf5] px-1 py-1.5 text-center align-middle shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
                                  <div className={`text-base font-black leading-none ${scoreClass(pick?.scoreToPar ?? null)}`}>{pick ? formatScore(pick.scoreToPar) : '—'}</div>
                                  <div className="mt-1 truncate text-[9px] font-black uppercase leading-none tracking-[0.02em] text-[#111]">{pick ? shortName(pick.name) : '—'}</div>
                                  <div className="mt-1 text-[8px] font-black uppercase tracking-[0.06em] text-[#555]">{pick ? (pick.isObStandIn ? 'OB' : thruLabel(pick.thru)) : '—'}</div>
                                </td>
                              )
                            })}
                            <td className="border-b border-r-2 border-[#111] bg-[#fbfbf5] px-1 py-1 align-middle">
                              <div className="flex flex-col gap-0.5 text-left">
                                {otherPicks.length > 0 ? otherPicks.map((pick, i) => (
                                  <div key={`${pick.name}-${i}`} title={`${pick.name}${pick.status !== 'active' ? ` · ${pick.status.toUpperCase()}` : ''}`} className="grid grid-cols-[28px_1fr] gap-1 leading-none">
                                    <span className={`text-right text-[9px] font-black ${pick.status !== 'active' ? 'text-[#b21e23]' : scoreClass(pick.scoreToPar)}`}>{pick.status !== 'active' ? pick.status.toUpperCase() : formatScore(pick.scoreToPar)}</span>
                                    <span className="truncate text-[8px] font-black uppercase tracking-[0.02em] text-[#111]">{shortName(pick.name)}</span>
                                  </div>
                                )) : <span className="text-center text-[9px] font-black uppercase text-[#555]">—</span>}
                              </div>
                            </td>
                            <td className={`border-b border-[#111] bg-[#fbfbf5] px-1 py-2 text-center text-2xl font-black ${scoreClass(entry.totalScore)}`}>
                              {formatScore(entry.totalScore)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {!scoringIsLive && (
                <p className="mt-2 border-2 border-[#111] bg-[#f7f7f2] px-4 py-3 text-xs font-bold uppercase tracking-[0.08em] text-[#111]">Live scoring appears here when the tournament starts.</p>
              )}
            </div>
            </div>
            <div className="mx-auto -mb-8 h-36 w-16 border-x-4 border-[#003622] bg-[#005b3c] shadow-[12px_0_0_#003622] md:-mb-10 md:h-44 md:w-20" />
            </>
          )}
        </div>
      )}

      {/* My Team Tab */}
      {tab === 'my-team' && (
        <div>
          {!myEntry ? (
            <div className="bg-white rounded-xl p-8 border border-stone-200 text-center">
              <p className="text-stone-600">You haven't joined this pool yet.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-stone-600 text-sm">
                  Pick {pool.pick_count} golfers. Best {pool.count_scores} scores count.
                  {isLocked && <span className="text-amber-400 ml-2">Picks are locked.</span>}
                </p>
                {!isLocked && (
                  <button onClick={savePicks} disabled={saving}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save Picks'}
                  </button>
                )}
              </div>

              {/* Selected picks */}
              <div className="bg-white rounded-xl p-4 border border-stone-200 mb-4">
                <h3 className="text-sm font-medium text-stone-700 mb-2">
                  Your Picks ({myPicks.length}/{pool.pick_count})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {myPicks.map(name => (
                    <span key={name} className="bg-emerald-50 text-emerald-900 border border-emerald-200 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                      {name}
                      {!isLocked && (
                        <button onClick={() => togglePick(name)} className="text-emerald-500 hover:text-red-400 ml-1">x</button>
                      )}
                    </span>
                  ))}
                  {myPicks.length === 0 && <span className="text-stone-500 text-sm">No golfers selected yet</span>}
                </div>
              </div>

              {/* Golfer list */}
              {!isLocked && field.length > 0 && (
                <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    {field.sort((a, b) => a.name.localeCompare(b.name)).map(player => {
                      const selected = myPicks.includes(player.name)
                      return (
                        <button key={player.id}
                          onClick={() => togglePick(player.name)}
                          disabled={!selected && myPicks.length >= pool.pick_count}
                          className={`w-full text-left px-4 py-2 flex items-center justify-between border-b border-stone-100 transition-colors ${
                            selected ? 'bg-emerald-50 text-emerald-900' :
                            myPicks.length >= pool.pick_count ? 'text-stone-400 cursor-not-allowed' :
                            'text-stone-800 hover:bg-stone-50'
                          }`}>
                          <span className="text-sm">{player.name}</span>
                          {selected && <span className="text-emerald-400 text-xs">Selected</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {field.length === 0 && (
                <div className="bg-white rounded-xl p-8 border border-stone-200 text-center">
                  <p className="text-stone-600">Tournament field not loaded yet. Check back when the tournament is closer.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Admin Tab */}
      {tab === 'admin' && isOwner && (
        <div className="space-y-6">
          {/* Pool controls */}
          <div className="bg-white rounded-xl p-5 border border-stone-200 shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-emerald-950">Pool controls</h3>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-stone-600">
                {isLocked ? 'Pool is locked. Unlock it if you need late entries or pick changes.' : 'Pool is open. Lock it when entries and picks are final.'}
              </p>
              <button onClick={() => setPoolLock(!isLocked)}
                className={`${isLocked ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-amber-600 hover:bg-amber-500'} text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors`}>
                {isLocked ? 'Unlock Pool' : 'Lock Picks'}
              </button>
            </div>
          </div>

          {/* Entries management */}
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-stone-200 bg-stone-50">
              <h3 className="text-lg font-semibold text-emerald-950">Manage entries ({activeEntries.length})</h3>
            </div>
            {entries.map(entry => (
              <div key={entry.id} className={`px-5 py-3 border-b border-stone-100 flex items-center justify-between ${entry.is_removed ? 'opacity-40' : ''}`}>
                <div>
                  <p className="font-medium text-stone-900">{entry.display_name}</p>
                  <p className="text-stone-500 text-xs">
                    {((entry.golfer_picks as string[]) || []).length} picks
                    {entry.is_removed && <span className="text-red-700 ml-2">Removed: {entry.removed_reason}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!entry.is_removed && entry.user_id !== userId && (
                    <button onClick={() => setRemoveTarget(entry.id)}
                      className="text-xs text-red-700 hover:text-red-800 px-2">Remove</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Remove confirmation modal */}
          {removeTarget && (
            <div className="fixed inset-0 bg-stone-950/40 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 border border-stone-200 max-w-sm w-full mx-4 shadow-2xl">
                <h3 className="text-lg font-semibold mb-3 text-emerald-950">Remove entry</h3>
                <p className="text-stone-600 text-sm mb-4">Remove this person from the pool? They won't be able to rejoin.</p>
                <input
                  type="text"
                  value={removeReason}
                  onChange={e => setRemoveReason(e.target.value)}
                  placeholder="Reason"
                  className="w-full bg-white border border-stone-300 rounded-lg px-4 py-2 text-stone-900 text-sm mb-4 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
                <div className="flex gap-3 justify-end">
                  <button onClick={() => { setRemoveTarget(null); setRemoveReason('') }}
                    className="text-stone-600 hover:text-stone-900 px-4 py-2 text-sm">Cancel</button>
                  <button onClick={() => removeEntry(removeTarget)}
                    className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm">Remove</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
