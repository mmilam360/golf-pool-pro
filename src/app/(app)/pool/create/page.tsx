'use client'
import { useState, useEffect } from 'react'
import { BackButton } from '@/components/BackButton'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import ShortUniqueId from 'short-unique-id'

interface Tournament {
  id: string; name: string; start_date: string; end_date: string; course: string; status: string
}

type PoolNumber = number | ''

function toNumber(value: PoolNumber, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizeTournamentKey(value?: string | null) {
  return (value || '')
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function getTournamentStart(value?: string) {
  if (!value) return null
  const [year, month, day] = value.split('T')[0].split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function hasTournamentStarted(tournament: Tournament, now = new Date()) {
  if (tournament.status !== 'upcoming') return true
  const start = getTournamentStart(tournament.start_date)
  return !start || start <= now
}

function eventClosedMessage(name?: string | null) {
  return name
    ? `Event closed: ${name} has already started, so new pools can’t be created for it.`
    : 'Event closed: this tournament has already started, so new pools can’t be created for it.'
}

function NumberStepper({
  label,
  value,
  min,
  max,
  fallback,
  onChange,
}: {
  label: string
  value: PoolNumber
  min: number
  max: number
  fallback: number
  onChange: (value: PoolNumber) => void
}) {
  const current = toNumber(value, fallback)
  const buttonClass = 'grid h-full w-[50px] shrink-0 place-items-center border-2 border-[#123c2f] bg-[#fbf7ed] text-xl font-black leading-none text-[#123c2f] transition-colors hover:bg-[#e7dbc3] disabled:cursor-not-allowed disabled:opacity-40 sm:w-[54px]'

  function setStepped(nextValue: number) {
    onChange(clamp(nextValue, min, max))
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-stone-700">{label}</label>
      <div className="grid h-12 grid-cols-[50px_minmax(0,1fr)_50px] overflow-hidden rounded-none border border-stone-300 bg-white focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-100 sm:grid-cols-[54px_minmax(0,1fr)_54px]">
        <button
          type="button"
          onClick={() => setStepped(current - 1)}
          disabled={current <= min}
          className={buttonClass}
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={event => {
            const raw = event.target.value.replace(/\D/g, '')
            onChange(raw === '' ? '' : clamp(Number(raw), min, max))
          }}
          onBlur={() => onChange(clamp(toNumber(value, fallback), min, max))}
          className="min-w-0 border-x border-stone-300 bg-white px-3 text-center text-lg font-black tabular-nums text-stone-900 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setStepped(current + 1)}
          disabled={current >= max}
          className={buttonClass}
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  )
}

export default function CreatePoolPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [selectedTournament, setSelectedTournament] = useState('')
  const [poolName, setPoolName] = useState('')
  const [pickCount, setPickCount] = useState<PoolNumber>(12)
  const [countScores, setCountScores] = useState<PoolNumber>(8)
  const [obEnabled, setObEnabled] = useState(true)
  const [obPenalty, setObPenalty] = useState<PoolNumber>(2)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()
  const tournament = tournaments.find(t => t.id === selectedTournament)

  useEffect(() => {
    loadTournaments()
  }, [])

  useEffect(() => {
    if (pickCount === '' || countScores === '') return
    if (countScores > pickCount) setCountScores(pickCount)
  }, [countScores, pickCount])

  async function loadTournaments() {
    const { data } = await supabase
      .from('gpp_tournaments')
      .select('id, name, start_date, end_date, course, status')
      .in('status', ['upcoming', 'live'])
      .order('start_date', { ascending: true })
    if (data) {
      const now = new Date()
      const openTournaments = data.filter(t => !hasTournamentStarted(t, now))
      setTournaments(openTournaments)

      const params = new URLSearchParams(window.location.search)
      const requestedTournament = params.get('tournament')
      const requestedStart = params.get('start')
      if (requestedTournament) {
        const requestedKey = normalizeTournamentKey(requestedTournament)
        const match = data.find(t => {
          const nameMatches = normalizeTournamentKey(t.name) === requestedKey
          const idMatches = t.id === requestedTournament
          const startMatches = !requestedStart || t.start_date?.startsWith(requestedStart)
          return (nameMatches || idMatches) && startMatches
        }) || data.find(t => normalizeTournamentKey(t.name).includes(requestedKey))

        if (match && hasTournamentStarted(match, now)) {
          setSelectedTournament('')
          setError(eventClosedMessage(match.name))
        } else if (match) {
          setError('')
          setSelectedTournament(match.id)
        } else {
          setSelectedTournament('')
          setError(eventClosedMessage(requestedTournament))
        }
      }
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setLoading(false); return }

    const finalPickCount = toNumber(pickCount, 12)
    const finalCountScores = toNumber(countScores, 8)
    const finalObPenalty = toNumber(obPenalty, 2)
    const selected = tournaments.find(t => t.id === selectedTournament)

    if (!selected) {
      setError('Choose an open tournament before creating a pool.')
      setLoading(false)
      return
    }

    if (hasTournamentStarted(selected)) {
      setError(eventClosedMessage(selected.name))
      setLoading(false)
      return
    }

    if (finalCountScores > finalPickCount) {
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
        pick_count: finalPickCount,
        count_scores: finalCountScores,
        ob_rule_enabled: obEnabled,
        ob_penalty_strokes: finalObPenalty,
        payment_status: 'active',
        paid_entry_limit: 5,
        activated_at: new Date().toISOString(),
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
    <div className="mx-auto w-full max-w-3xl pr-1 pb-1 lg:pr-0 lg:pb-0">
      <div>
        <BackButton />
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Tournament setup</p>
        <h1 className="mb-6 font-display text-4xl font-bold tracking-[-0.03em] text-emerald-950">Create a Pool</h1>
        {error && <div className="mb-4 rounded-none border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleCreate} className="w-[calc(100%-4px)] space-y-6 rounded-none border-2 border-[#123c2f] bg-white p-4 shadow-[4px_4px_0_#d8cab0] sm:w-full sm:p-6 sm:shadow-[6px_6px_0_#d8cab0]">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Pool Name</label>
            <input type="text" value={poolName} onChange={e => setPoolName(e.target.value)} required
              placeholder="e.g. Tiger's Tribe PGA Pool"
              className="w-full rounded-none border border-stone-300 bg-white px-4 py-3 text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Tournament</label>
            <select value={selectedTournament} onChange={e => setSelectedTournament(e.target.value)} required
              className="w-full rounded-none border border-stone-300 bg-white px-4 py-3 text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100">
              <option value="">Select a tournament...</option>
              {tournaments.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} - {t.course || 'TBD'} ({t.start_date})
                </option>
              ))}
            </select>
            {tournament ? (
              <div className="mt-3 border border-[#d8cab0] bg-[#fbf7ed] px-3 py-3 text-sm text-[#1f2a24]">
                <p className="font-black uppercase tracking-[0.08em] text-[#123c2f]">{tournament.name}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#657168]">{tournament.course || 'Course TBA'} · {tournament.start_date || 'Date TBA'}</p>
              </div>
            ) : null}
            {tournaments.length === 0 && (
              <p className="mt-1 text-xs text-stone-500">No upcoming tournaments loaded. Sync tournaments first.</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberStepper label="Golfers to Pick" value={pickCount} onChange={setPickCount} min={1} max={30} fallback={12} />
            <NumberStepper label="Scores to Count" value={countScores} onChange={setCountScores} min={1} max={toNumber(pickCount, 12)} fallback={8} />
          </div>

          <div className="rounded-none border border-amber-100 bg-amber-50 p-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-stone-800">Out of Bounds Rule</label>
              <button type="button" onClick={() => setObEnabled(!obEnabled)}
                className={`h-6 w-12 rounded-full transition-colors ${obEnabled ? 'bg-emerald-700' : 'bg-stone-300'}`}>
                <div className={`h-5 w-5 rounded-full bg-white transition-transform ${obEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {obEnabled && (
              <div className="mt-3">
                <NumberStepper label="OB Penalty Strokes" value={obPenalty} onChange={setObPenalty} min={1} max={10} fallback={2} />
              </div>
            )}
            <p className="mt-3 text-xs leading-5 text-stone-600">
              {obEnabled
                ? `Golfers missing the cut get replaced by OB stand-ins (${toNumber(obPenalty, 2)} strokes worse than last-place finisher).`
                : 'Only golfers who make the cut count toward your score.'}
            </p>
          </div>

          <button type="submit" disabled={loading || !selectedTournament}
            className="gpp-3d gpp-button-3d gpp-button-wrap w-full disabled:opacity-50">
            <span className="gpp-button-face py-3">{loading ? 'Creating...' : 'Create Pool'}</span>
          </button>
        </form>
      </div>
    </div>
  )
}
