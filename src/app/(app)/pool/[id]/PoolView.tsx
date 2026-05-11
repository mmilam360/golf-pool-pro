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
  if (score < 0) return 'text-emerald-800'
  if (score > 0) return 'text-red-700'
  return 'text-stone-900'
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
  const [emailRecipients, setEmailRecipients] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  const [removeReason, setRemoveReason] = useState('')
  const supabase = createClient()

  const activeEntries = entries.filter(e => !e.is_removed)
  const isLocked = pool.is_locked
  const scoringIsLive = tournament?.status === 'live' || tournament?.status === 'completed'

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

  function copyInvite() {
    const url = `${window.location.origin}/pool/join?code=${pool.passcode}`
    navigator.clipboard?.writeText(url)
    setStatusMessage('Invite link copied.')
    setTimeout(() => setStatusMessage(''), 2500)
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

      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-950">Invite players</p>
            <p className="text-sm text-stone-700">Send the join code <span className="font-mono font-semibold text-emerald-800">{pool.passcode}</span> or copy the invite link.</p>
          </div>
          <button onClick={copyInvite} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800">
            Copy invite link
          </button>
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
              <button onClick={sendInvites} disabled={emailSending} className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-stone-800 disabled:opacity-50">
                {emailSending ? 'Sending...' : 'Send invites'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
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
            <div className="overflow-hidden rounded-sm border-2 border-stone-500 bg-[#fbf7ed] shadow-sm">
              <div className="border-b-2 border-stone-500 bg-[#f8f1df] px-4 py-3 text-center">
                <p className="text-lg font-black uppercase tracking-[0.22em] text-stone-950">{pool.name}</p>
                <p className="mt-1 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-stone-600">
                  Pool leaders · top {pool.count_scores} scores to par counting
                </p>
              </div>
              <p className="border-b border-stone-300 bg-[#f8f1df] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-stone-500 lg:hidden">
                Swipe sideways to view all golfer columns and total.
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-[1180px] w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="border-b-2 border-stone-500 bg-[#efe2c3] font-mono text-[10px] font-black uppercase tracking-[0.12em] text-stone-800">
                      <th className="sticky left-0 z-30 w-12 border-r-2 border-stone-500 bg-[#efe2c3] px-2 py-2 text-center">Rank</th>
                      <th className="sticky left-12 z-30 w-44 border-r-2 border-stone-500 bg-[#efe2c3] px-3 py-2 text-left">Entry</th>
                      {Array.from({ length: pool.count_scores }, (_, i) => (
                        <th key={i} className="w-24 border-r border-stone-400 px-2 py-2 text-center">G{i + 1}</th>
                      ))}
                      <th className="w-20 border-r-2 border-stone-500 px-2 py-2 text-center">Live</th>
                      <th className="w-20 px-2 py-2 text-center">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scoredEntries.map(entry => {
                      const isMe = entry.entryId === myEntry?.id
                      const countingPicks = entry.pickScores.filter(pick => pick.counted).slice(0, pool.count_scores)
                      const countedReal = countingPicks.filter(pick => !pick.isObStandIn).length
                      return (
                        <tr key={entry.entryId} className={`border-b border-stone-400 ${isMe ? 'bg-emerald-50' : 'bg-white/70'}`}>
                          <td className="sticky left-0 z-20 border-r-2 border-stone-500 bg-inherit px-2 py-2 text-center font-mono text-base font-black text-red-700">
                            {entry.rank || '—'}
                          </td>
                          <td className="sticky left-12 z-20 border-r-2 border-stone-500 bg-inherit px-3 py-2">
                            <div className="font-bold uppercase tracking-[0.04em] text-stone-950">{entry.displayName}</div>
                            <div className="mt-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-stone-500">
                              {scoringIsLive ? `${countedReal}/${pool.count_scores} counting` : 'Waiting'}
                              {entry.obStandIns > 0 && <span className="text-amber-700"> · {entry.obStandIns} OB</span>}
                              {isMe && <span className="text-emerald-700"> · You</span>}
                            </div>
                          </td>
                          {Array.from({ length: pool.count_scores }, (_, i) => {
                            const pick = countingPicks[i]
                            return (
                              <td key={i} title={pick?.name || ''} className="border-r border-stone-300 bg-inherit px-1.5 py-2 text-center align-middle">
                                <div className={`font-mono text-base font-black leading-none ${scoreClass(pick?.scoreToPar ?? null)}`}>{pick ? formatScore(pick.scoreToPar) : '—'}</div>
                                <div className="mt-1 truncate text-[10px] font-bold uppercase leading-none tracking-[0.02em] text-stone-800">{pick ? shortName(pick.name) : '—'}</div>
                                <div className="mt-1 font-mono text-[8px] font-bold uppercase tracking-[0.06em] text-stone-500">{pick ? (pick.isObStandIn ? 'OB' : thruLabel(pick.thru)) : '—'}</div>
                              </td>
                            )
                          })}
                          <td className="border-r-2 border-stone-500 px-2 py-2 text-center font-mono text-[11px] font-bold uppercase text-stone-600">
                            {scoringIsLive ? 'Live' : '—'}
                          </td>
                          <td className={`px-2 py-2 text-center font-mono text-xl font-black ${scoreClass(entry.totalScore)}`}>
                            {formatScore(entry.totalScore)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {!scoringIsLive && (
                <p className="border-t border-stone-300 bg-white/70 px-4 py-3 text-xs text-stone-600">Live scoring appears here when the tournament starts.</p>
              )}
            </div>
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
