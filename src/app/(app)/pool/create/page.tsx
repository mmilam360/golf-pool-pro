'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import ShortUniqueId from 'short-unique-id'

interface Tournament {
  id: string; name: string; start_date: string; end_date: string; course: string; status: string
}

export default function CreatePoolPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [selectedTournament, setSelectedTournament] = useState('')
  const [poolName, setPoolName] = useState('')
  const [pickCount, setPickCount] = useState(12)
  const [countScores, setCountScores] = useState(8)
  const [obEnabled, setObEnabled] = useState(true)
  const [obPenalty, setObPenalty] = useState(2)
  const [buyIn, setBuyIn] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadTournaments()
  }, [])

  async function loadTournaments() {
    const { data } = await supabase
      .from('gpp_tournaments')
      .select('id, name, start_date, end_date, course, status')
      .in('status', ['upcoming', 'live'])
      .order('start_date', { ascending: true })
    if (data) setTournaments(data)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setLoading(false); return }

    if (countScores > pickCount) {
      setError('Scores to Count cannot be greater than Golfers to Pick')
      setLoading(false)
      return
    }

    const uid = new ShortUniqueId({ length: 6 })
    const passcode = uid.randomUUID().toUpperCase()

    const { data, error: insertError } = await supabase
      .from('gpp_pools')
      .insert({
        tournament_id: selectedTournament,
        name: poolName,
        owner_id: user.id,
        passcode,
        pick_count: pickCount,
        count_scores: countScores,
        ob_rule_enabled: obEnabled,
        ob_penalty_strokes: obPenalty,
        buy_in_amount: buyIn,
      })
      .select('id')
      .single()

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
    } else {
      const { data: profile } = await supabase
        .from('gpp_profiles')
        .select('display_name')
        .eq('id', user.id)
        .single()

      const { error: entryError } = await supabase
        .from('gpp_entries')
        .insert({
          pool_id: data.id,
          user_id: user.id,
          display_name: profile?.display_name || user.email?.split('@')[0] || 'Player',
          golfer_picks: [],
          has_paid: buyIn === 0,
        })

      if (entryError) {
        await supabase
          .from('gpp_pools')
          .delete()
          .eq('id', data.id)
          .eq('owner_id', user.id)
        setError(entryError.message)
        setLoading(false)
        return
      }

      router.push(`/pool/${data.id}`)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700 mb-2">Tournament setup</p>
      <h1 className="text-3xl font-bold mb-8 text-emerald-950">Create a Pool</h1>
      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm border border-red-200">{error}</div>}

      <form onSubmit={handleCreate} className="space-y-6 bg-white rounded-lg p-6 border border-stone-200 shadow-sm">
        <div>
          <label className="block text-stone-700 text-sm font-medium mb-1">Pool Name</label>
          <input type="text" value={poolName} onChange={e => setPoolName(e.target.value)} required
            placeholder="e.g. Saturday Squads Masters Pool"
            className="w-full bg-white border border-stone-300 rounded-lg px-4 py-3 text-stone-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
        </div>

        <div>
          <label className="block text-stone-700 text-sm font-medium mb-1">Tournament</label>
          <select value={selectedTournament} onChange={e => setSelectedTournament(e.target.value)} required
            className="w-full bg-white border border-stone-300 rounded-lg px-4 py-3 text-stone-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100">
            <option value="">Select a tournament...</option>
            {tournaments.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} - {t.course || 'TBD'} ({t.start_date})
              </option>
            ))}
          </select>
          {tournaments.length === 0 && (
            <p className="text-stone-500 text-xs mt-1">No upcoming tournaments loaded. Sync tournaments first.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-stone-700 text-sm font-medium mb-1">Golfers to Pick</label>
            <input type="number" value={pickCount} onChange={e => setPickCount(parseInt(e.target.value) || 12)}
              min={1} max={30}
              className="w-full bg-white border border-stone-300 rounded-lg px-4 py-3 text-stone-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
          </div>
          <div>
            <label className="block text-stone-700 text-sm font-medium mb-1">Scores to Count</label>
            <input type="number" value={countScores} onChange={e => setCountScores(parseInt(e.target.value) || 8)}
              min={1} max={pickCount}
              className="w-full bg-white border border-stone-300 rounded-lg px-4 py-3 text-stone-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
          </div>
        </div>

        <div className="bg-amber-50 rounded-lg p-4 space-y-3 border border-amber-100">
          <div className="flex items-center justify-between">
            <label className="text-stone-800 text-sm font-medium">Out of Bounds Rule</label>
            <button type="button" onClick={() => setObEnabled(!obEnabled)}
              className={`w-12 h-6 rounded-full transition-colors ${obEnabled ? 'bg-emerald-700' : 'bg-stone-300'}`}>
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${obEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {obEnabled && (
            <div>
              <label className="block text-stone-600 text-xs mb-1">OB Penalty Strokes</label>
              <input type="number" value={obPenalty} onChange={e => setObPenalty(parseInt(e.target.value) || 2)}
                min={1} max={10}
                className="w-full bg-white border border-stone-300 rounded-lg px-4 py-3 text-stone-900 text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
            </div>
          )}
          <p className="text-stone-600 text-xs leading-5">
            {obEnabled
              ? `Golfers missing the cut get replaced by OB stand-ins (${obPenalty} strokes worse than last-place finisher)`
              : 'Only golfers who make the cut count toward your score'}
          </p>
        </div>

        <div>
          <label className="block text-stone-700 text-sm font-medium mb-1">Buy-in Amount ($)</label>
          <input type="number" value={buyIn} onChange={e => setBuyIn(parseFloat(e.target.value) || 0)}
            min={0} step={0.01}
            className="w-full bg-white border border-stone-300 rounded-lg px-4 py-3 text-stone-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
          <p className="text-stone-500 text-xs mt-1">Set to 0 for free pools</p>
        </div>

        <button type="submit" disabled={loading || !selectedTournament}
          className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 shadow-sm">
          {loading ? 'Creating...' : 'Create Pool'}
        </button>
      </form>
    </div>
  )
}
