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

export default function PoolView({ pool, tournament, entries: initialEntries, myEntry: initialMyEntry, isOwner, userId }: Props) {
  const [tab, setTab] = useState<Tab>('leaderboard')
  const [entries, setEntries] = useState(initialEntries)
  const [myEntry, setMyEntry] = useState(initialMyEntry)
  const [leaderboard, setLeaderboard] = useState<GolfPlayer[]>([])
  const [field, setField] = useState<GolfPlayer[]>([])
  const [myPicks, setMyPicks] = useState<string[]>(initialMyEntry?.golfer_picks || [])
  const [loadingScores, setLoadingScores] = useState(false)
  const [saving, setSaving] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  const [removeReason, setRemoveReason] = useState('')
  const supabase = createClient()

  const activeEntries = entries.filter(e => !e.is_removed)
  const isLocked = pool.is_locked

  // Fetch live leaderboard
  const fetchScores = useCallback(async () => {
    if (!tournament?.external_id) return
    setLoadingScores(true)
    try {
      const res = await fetch(`/api/tournaments/leaderboard?id=${tournament.external_id}`)
      if (res.ok) {
        const data = await res.json()
        setLeaderboard(data.leaderboard || [])
        setField(data.leaderboard || [])
      }
    } catch {}
    setLoadingScores(false)
  }, [tournament?.external_id])

  useEffect(() => {
    // Load field from tournament data if available
    if (tournament?.field_json) {
      setField(tournament.field_json as GolfPlayer[])
    }
    if (tournament?.leaderboard_json) {
      setLeaderboard(tournament.leaderboard_json as GolfPlayer[])
    }
    fetchScores()
    const interval = setInterval(fetchScores, 60000) // refresh every minute
    return () => clearInterval(interval)
  }, [fetchScores, tournament])

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
    }
    setSaving(false)
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

  // Toggle paid status (admin)
  async function togglePaid(entryId: string, currentPaid: boolean) {
    const { error } = await supabase
      .from('gpp_entries')
      .update({ has_paid: !currentPaid })
      .eq('id', entryId)
    if (!error) {
      setEntries(entries.map(e => e.id === entryId ? { ...e, has_paid: !currentPaid } : e))
    }
  }

  // Lock pool (admin)
  async function lockPool() {
    const { error } = await supabase
      .from('gpp_pools')
      .update({ is_locked: true })
      .eq('id', pool.id)
    if (!error) {
      pool.is_locked = true
      window.location.reload()
    }
  }

  // Compute scored entries
  const scoredEntries: ScoredEntry[] = rankEntries(
    activeEntries.map(entry => ({
      ...scoreEntry(
        (entry.golfer_picks as string[]) || [],
        leaderboard,
        { countScores: pool.count_scores, obRuleEnabled: pool.ob_rule_enabled, obPenaltyStrokes: pool.ob_penalty_strokes }
      ),
      entryId: entry.id,
      displayName: entry.display_name,
    }))
  )

  // Payout calculator
  const paidEntries = activeEntries.filter(e => e.has_paid)
  const totalPot = paidEntries.length * (pool.buy_in_amount || 0)
  const payoutStructure = (pool.payout_structure as { place: number; percent: number }[]) || [
    { place: 1, percent: 50 }, { place: 2, percent: 30 }, { place: 3, percent: 20 },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{pool.name}</h1>
        <p className="text-zinc-400 mt-1">{tournament?.name || 'Tournament'} at {tournament?.course || 'TBD'}</p>
        <div className="flex items-center gap-4 mt-2 text-sm">
          <span className="text-zinc-500">Passcode: <span className="text-emerald-400 font-mono">{pool.passcode}</span></span>
          <span className="text-zinc-500">{activeEntries.length} {activeEntries.length === 1 ? 'entry' : 'entries'}</span>
          {pool.buy_in_amount > 0 && <span className="text-zinc-500">${pool.buy_in_amount} buy-in</span>}
          {isLocked && <span className="text-amber-400">Picks locked</span>}
          {pool.is_completed && <span className="text-emerald-400">Final results</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-zinc-900 rounded-lg p-1 inline-flex">
        {(['leaderboard', 'my-team', ...(isOwner ? ['admin'] as Tab[] : [])] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
            }`}>
            {t === 'leaderboard' ? 'Leaderboard' : t === 'my-team' ? 'My Team' : 'Admin'}
          </button>
        ))}
      </div>

      {/* Leaderboard Tab */}
      {tab === 'leaderboard' && (
        <div>
          {loadingScores && <p className="text-zinc-500 text-sm mb-4">Loading scores...</p>}
          {scoredEntries.length === 0 ? (
            <div className="bg-zinc-900 rounded-xl p-8 border border-zinc-800 text-center">
              <p className="text-zinc-500">No entries yet. Share passcode <span className="text-emerald-400 font-mono">{pool.passcode}</span></p>
            </div>
          ) : (
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 text-sm">
                    <th className="text-left px-4 py-3 w-16">#</th>
                    <th className="text-left px-4 py-3">Player</th>
                    <th className="text-center px-4 py-3">Score</th>
                    <th className="text-center px-4 py-3">Counting</th>
                    {pool.buy_in_amount > 0 && <th className="text-center px-4 py-3">Paid</th>}
                  </tr>
                </thead>
                <tbody>
                  {scoredEntries.map(entry => {
                    const original = activeEntries.find(e => e.id === entry.entryId)
                    const isMe = entry.entryId === myEntry?.id
                    return (
                      <tr key={entry.entryId} className={`border-b border-zinc-800/50 ${isMe ? 'bg-emerald-950/20' : ''}`}>
                        <td className="px-4 py-3 font-mono text-zinc-400">{entry.rank || '-'}</td>
                        <td className="px-4 py-3 font-medium">{entry.displayName} {isMe && <span className="text-emerald-400 text-xs">(you)</span>}</td>
                        <td className="px-4 py-3 text-center font-mono">
                          {entry.totalScore !== null ? (
                            <span className={entry.totalScore < 0 ? 'text-emerald-400' : entry.totalScore > 0 ? 'text-red-400' : 'text-white'}>
                              {entry.totalScore > 0 ? '+' : ''}{entry.totalScore}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-zinc-400">
                          {entry.pickScores.filter(p => p.counted && !p.isObStandIn).length}/{pool.count_scores}
                          {entry.obStandIns > 0 && <span className="text-amber-400 ml-1">(+{entry.obStandIns} OB)</span>}
                        </td>
                        {pool.buy_in_amount > 0 && (
                          <td className="px-4 py-3 text-center">
                            {original?.has_paid ? <span className="text-emerald-400 text-sm">Yes</span> : <span className="text-zinc-600 text-sm">No</span>}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* My Team Tab */}
      {tab === 'my-team' && (
        <div>
          {!myEntry ? (
            <div className="bg-zinc-900 rounded-xl p-8 border border-zinc-800 text-center">
              <p className="text-zinc-500">You haven't joined this pool yet.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-zinc-400 text-sm">
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
              <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 mb-4">
                <h3 className="text-sm font-medium text-zinc-400 mb-2">
                  Your Picks ({myPicks.length}/{pool.pick_count})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {myPicks.map(name => (
                    <span key={name} className="bg-emerald-900/40 text-emerald-300 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                      {name}
                      {!isLocked && (
                        <button onClick={() => togglePick(name)} className="text-emerald-500 hover:text-red-400 ml-1">x</button>
                      )}
                    </span>
                  ))}
                  {myPicks.length === 0 && <span className="text-zinc-600 text-sm">No golfers selected yet</span>}
                </div>
              </div>

              {/* Golfer list */}
              {!isLocked && field.length > 0 && (
                <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    {field.sort((a, b) => a.name.localeCompare(b.name)).map(player => {
                      const selected = myPicks.includes(player.name)
                      return (
                        <button key={player.id}
                          onClick={() => togglePick(player.name)}
                          disabled={!selected && myPicks.length >= pool.pick_count}
                          className={`w-full text-left px-4 py-2 flex items-center justify-between border-b border-zinc-800/50 transition-colors ${
                            selected ? 'bg-emerald-950/30 text-emerald-300' :
                            myPicks.length >= pool.pick_count ? 'text-zinc-600 cursor-not-allowed' :
                            'text-zinc-300 hover:bg-zinc-800'
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
                <div className="bg-zinc-900 rounded-xl p-8 border border-zinc-800 text-center">
                  <p className="text-zinc-500">Tournament field not loaded yet. Check back when the tournament is closer.</p>
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
          <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
            <h3 className="text-lg font-semibold mb-4">Pool Controls</h3>
            <div className="flex gap-3">
              {!isLocked && (
                <button onClick={lockPool}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors">
                  Lock Picks
                </button>
              )}
            </div>
          </div>

          {/* Payout Calculator */}
          {pool.buy_in_amount > 0 && (
            <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
              <h3 className="text-lg font-semibold mb-4">Payout Calculator</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-zinc-400">
                  <span>Paid entries: {paidEntries.length} / {activeEntries.length}</span>
                  <span>Total pot: ${totalPot.toFixed(2)}</span>
                </div>
                {payoutStructure.map(p => {
                  const winner = scoredEntries[p.place - 1]
                  return (
                    <div key={p.place} className="flex justify-between py-1 border-t border-zinc-800">
                      <span className="text-zinc-300">Place {p.place}: {winner?.displayName || 'TBD'}</span>
                      <span className="text-emerald-400">${(totalPot * p.percent / 100).toFixed(2)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Entries management */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800">
              <h3 className="text-lg font-semibold">Manage Entries ({activeEntries.length})</h3>
            </div>
            {entries.map(entry => (
              <div key={entry.id} className={`px-5 py-3 border-b border-zinc-800/50 flex items-center justify-between ${entry.is_removed ? 'opacity-40' : ''}`}>
                <div>
                  <p className="font-medium">{entry.display_name}</p>
                  <p className="text-zinc-500 text-xs">
                    {((entry.golfer_picks as string[]) || []).length} picks
                    {entry.is_removed && <span className="text-red-400 ml-2">Removed: {entry.removed_reason}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {pool.buy_in_amount > 0 && !entry.is_removed && (
                    <button onClick={() => togglePaid(entry.id, entry.has_paid)}
                      className={`text-xs px-3 py-1 rounded-full ${entry.has_paid ? 'bg-emerald-900/40 text-emerald-300' : 'bg-zinc-800 text-zinc-400'}`}>
                      {entry.has_paid ? 'Paid' : 'Unpaid'}
                    </button>
                  )}
                  {!entry.is_removed && entry.user_id !== userId && (
                    <button onClick={() => setRemoveTarget(entry.id)}
                      className="text-xs text-red-400 hover:text-red-300 px-2">Remove</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Remove confirmation modal */}
          {removeTarget && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
              <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 max-w-sm w-full mx-4">
                <h3 className="text-lg font-semibold mb-3">Remove Entry</h3>
                <p className="text-zinc-400 text-sm mb-4">Remove this person from the pool? They won't be able to rejoin.</p>
                <input
                  type="text"
                  value={removeReason}
                  onChange={e => setRemoveReason(e.target.value)}
                  placeholder="Reason (e.g. didn't pay)"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white text-sm mb-4 focus:outline-none focus:border-emerald-500"
                />
                <div className="flex gap-3 justify-end">
                  <button onClick={() => { setRemoveTarget(null); setRemoveReason('') }}
                    className="text-zinc-400 hover:text-white px-4 py-2 text-sm">Cancel</button>
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
