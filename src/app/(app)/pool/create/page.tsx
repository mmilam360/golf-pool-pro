'use client'
import { useState, useEffect } from 'react'
import { BackButton } from '@/components/BackButton'
import { createClient } from '@/lib/supabase/client'
import { trackGppEvent } from '@/lib/posthog-events'
import { useRouter } from 'next/navigation'
import ShortUniqueId from 'short-unique-id'
import { formatDateOnly, hasDateOnlyStarted } from '@/lib/date-utils'
import { buildRunItBackDefaults, selectNextRunItBackTournament } from '@/lib/run-it-back'
import { buildPickGroups, type PoolGameFormat } from '@/lib/pool-formats'

interface Tournament {
  id: string; name: string; start_date: string; end_date: string; course: string; status: string; field_json?: any[] | null; leaderboard_json?: any[] | null
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

function hasTournamentStarted(tournament: Tournament, now = new Date()) {
  if (tournament.status !== 'upcoming') return true
  return hasDateOnlyStarted(tournament.start_date, now)
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

function InfoIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" />
      <path d="M10 9v5" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
      <path d="M10 6h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
    </svg>
  )
}

export default function CreatePoolPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [selectedTournament, setSelectedTournament] = useState('')
  const [poolName, setPoolName] = useState('')
  const [pickCount, setPickCount] = useState<PoolNumber>(12)
  const [countScores, setCountScores] = useState<PoolNumber>(8)
  const [gameFormat, setGameFormat] = useState<PoolGameFormat>('standard')
  const [groupCount, setGroupCount] = useState<PoolNumber>(6)
  const [picksPerGroup, setPicksPerGroup] = useState<PoolNumber>(2)
  const [obEnabled, setObEnabled] = useState(true)
  const [obPenalty, setObPenalty] = useState<PoolNumber>(2)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cloneSourceId, setCloneSourceId] = useState('')
  const [cloneSourceName, setCloneSourceName] = useState('')
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

  useEffect(() => {
    if (gameFormat === 'standard') return
    const totalPicks = toNumber(groupCount, 6) * toNumber(picksPerGroup, 2)
    setPickCount(totalPicks)
    if (countScores === '' || countScores > totalPicks) setCountScores(Math.min(8, totalPicks))
  }, [countScores, gameFormat, groupCount, picksPerGroup])

  async function loadTournaments() {
    const { data } = await supabase
      .from('gpp_tournaments')
      .select('id, name, start_date, end_date, course, status, field_json, leaderboard_json')
      .in('status', ['upcoming', 'live'])
      .order('start_date', { ascending: true })
    if (data) {
      const now = new Date()
      const openTournaments = data.filter(t => !hasTournamentStarted(t, now))
      setTournaments(openTournaments)

      const params = new URLSearchParams(window.location.search)
      const cloneId = params.get('clone') || ''
      const requestedTournament = params.get('tournament')
      const requestedStart = params.get('start')
      if (cloneId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: sourcePool } = await supabase
            .from('gpp_pools')
            .select('id, name, pick_count, count_scores, ob_rule_enabled, ob_penalty_strokes, game_format, group_count, picks_per_group')
            .eq('id', cloneId)
            .eq('owner_id', user.id)
            .maybeSingle()
          const cloneDefaults = sourcePool ? buildRunItBackDefaults(sourcePool) : null
          if (cloneDefaults) {
            setCloneSourceId(cloneDefaults.sourceId)
            setCloneSourceName(cloneDefaults.sourceName)
            setPoolName(cloneDefaults.poolName)
            setPickCount(cloneDefaults.pickCount)
            setCountScores(cloneDefaults.countScores)
            setGameFormat(cloneDefaults.gameFormat)
            setGroupCount(cloneDefaults.groupCount)
            setPicksPerGroup(cloneDefaults.picksPerGroup)
            setObEnabled(cloneDefaults.obEnabled)
            setObPenalty(cloneDefaults.obPenalty)
            const cloneTournament = selectNextRunItBackTournament(openTournaments, now)
            if (!requestedTournament && cloneTournament?.id) setSelectedTournament(cloneTournament.id)
          }
        }
      }
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

    const selected = tournaments.find(t => t.id === selectedTournament)
    trackGppEvent('create_pool_clicked', {
      tournament: selected?.name || null,
      tournament_id: selectedTournament || null,
      pick_count: toNumber(pickCount, 12),
      count_scores: toNumber(countScores, 8),
      cloned_pool: Boolean(cloneSourceId),
    })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setLoading(false); return }

    const finalPickCount = toNumber(pickCount, 12)
    const finalCountScores = toNumber(countScores, 8)
    const finalObPenalty = toNumber(obPenalty, 2)
    const finalGroupCount = gameFormat === 'standard' ? 0 : toNumber(groupCount, 6)
    const finalPicksPerGroup = gameFormat === 'standard' ? 0 : toNumber(picksPerGroup, 2)
    const finalGroupedPickCount = finalGroupCount * finalPicksPerGroup

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

    if (gameFormat !== 'standard' && finalGroupedPickCount !== finalPickCount) {
      setError('Grouped pools must pick the same total as groups × picks per group.')
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
        game_format: gameFormat,
        group_count: finalGroupCount,
        picks_per_group: finalPicksPerGroup,
        pick_groups_json: [],
        field_snapshot_json: null,
        groups_finalized_at: null,
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

      if (gameFormat !== 'standard') {
        const fieldSnapshot = Array.isArray(selected.field_json) && selected.field_json.length > 0
          ? selected.field_json
          : Array.isArray(selected.leaderboard_json)
            ? selected.leaderboard_json
            : []
        const groups = buildPickGroups({
          field: fieldSnapshot,
          format: gameFormat,
          groupCount: finalGroupCount,
          seed: `${selectedTournament}:${passcode}:${gameFormat}`,
        })
        if (groups.length > 0) {
          await supabase
            .from('gpp_pools')
            .update({
              pick_groups_json: groups,
              field_snapshot_json: fieldSnapshot,
              groups_finalized_at: null,
            })
            .eq('id', data.id)
            .eq('owner_id', user.id)
        }
      }

      trackGppEvent('pool_created', {
        pool_id: data.id,
        tournament: selected.name,
        tournament_id: selectedTournament,
        pick_count: finalPickCount,
        count_scores: finalCountScores,
        is_paid: false,
        cloned_pool: Boolean(cloneSourceId),
      })

      router.push(`/pool/${data.id}${cloneSourceId ? `?inviteFrom=${cloneSourceId}` : ''}`)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl pr-1 pb-1 lg:pr-0 lg:pb-0">
      <div>
        <BackButton />
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Tournament setup</p>
        <h1 className="mb-6 font-display text-4xl font-bold tracking-[-0.03em] text-emerald-950">Create a Pool</h1>
        {cloneSourceName && (
          <div className="mb-4 border border-[#d8cab0] bg-[#fbf7ed] px-4 py-3 text-sm font-semibold text-[#123c2f]">
            Running it back from {cloneSourceName}. Edit anything here, then choose the new tournament.
          </div>
        )}
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
                  {t.name} - {t.course || 'TBD'} ({formatDateOnly(t.start_date)})
                </option>
              ))}
            </select>
            {tournament ? (
              <div className="mt-3 border border-[#d8cab0] bg-[#fbf7ed] px-3 py-3 text-sm text-[#1f2a24]">
                <p className="font-black uppercase tracking-[0.08em] text-[#123c2f]">{tournament.name}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#657168]">{tournament.course || 'Course TBA'} · {formatDateOnly(tournament.start_date)}</p>
                <p className="mt-2 text-xs font-bold text-[#123c2f]">Entries lock automatically before the first tee time Thursday.</p>
              </div>
            ) : null}
            {tournaments.length === 0 && (
              <p className="mt-1 text-xs text-stone-500">No upcoming tournaments loaded. Sync tournaments first.</p>
            )}
          </div>

          <div className="rounded-none border border-[#d8cab0] bg-[#fbf7ed] p-4">
            <label className="mb-2 block text-sm font-medium text-stone-800">Game format</label>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                {
                  value: 'standard',
                  label: 'Open Field',
                  helper: 'Open field, no groups.',
                  image: '/game-modes/standard-wordmark.svg',
                },
                {
                  value: 'ranked_groups',
                  label: 'Tiered Picks',
                  helper: 'Ranked by World Golf Ranking. Players pick from each tier.',
                  image: '/game-modes/ranked-wordmark.svg',
                },
                {
                  value: 'random_groups',
                  label: 'Clubhouse Chaos',
                  helper: 'Field is randomly shuffled, then divided into groups. Everyone gets the same groups.',
                  image: '/game-modes/clubhouse-chaos-wordmark.svg',
                },
              ].map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setGameFormat(option.value as PoolGameFormat)}
                  className={`border-2 px-3 py-3 text-left transition-colors ${gameFormat === option.value ? 'border-[#123c2f] bg-white text-[#123c2f]' : 'border-[#d8cab0] bg-[#fffaf0] text-stone-700 hover:border-[#123c2f]'}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- these are static mode-card tags, not LCP content */}
                  <img
                    src={option.image}
                    alt=""
                    aria-hidden="true"
                    className="mb-3 aspect-[16/11] w-full border border-[#d8cab0] bg-[#fbf7ed] object-cover"
                    loading="eager"
                  />
                  <span className="block text-center text-sm font-black uppercase tracking-[0.08em]">{option.label}</span>
                  <span className="mt-1 block text-center text-xs font-semibold leading-4">{option.helper}</span>
                </button>
              ))}
            </div>
            {gameFormat !== 'standard' && (
              <div className="mt-3 border border-[#d8cab0] bg-white text-xs leading-5 text-stone-700">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 font-black uppercase tracking-[0.08em] text-[#123c2f] [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-2"><InfoIcon /> How this format works</span>
                    <span className="text-lg leading-none text-[#b21e23] group-open:hidden">+</span>
                    <span className="hidden text-lg leading-none text-[#b21e23] group-open:block">−</span>
                  </summary>
                  <div className="space-y-3 border-t border-[#d8cab0] px-3 pb-3 pt-3">
                    {gameFormat === 'ranked_groups' ? (
                      <>
                        <p>The field is ranked by World Golf Ranking, then split into the number of tiers you choose. Every entry picks the same number of golfers from each tier.</p>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <div className="border border-[#d8cab0] bg-[#fbf7ed] p-2"><strong className="block text-[#0f2f25]">Tier 1</strong>Scheffler, McIlroy, Schauffele, Rahm</div>
                          <div className="border border-[#d8cab0] bg-[#fbf7ed] p-2"><strong className="block text-[#0f2f25]">Tier 2</strong>Morikawa, Hovland, Fleetwood, Cantlay</div>
                          <div className="border border-[#d8cab0] bg-[#fbf7ed] p-2"><strong className="block text-[#0f2f25]">Tier 3</strong>Lowry, Burns, Finau, Fowler</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <p>The field is shuffled once when groups lock, then divided into groups. Everyone picks from the same shuffled groups.</p>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <div className="border border-[#d8cab0] bg-[#fbf7ed] p-2"><strong className="block text-[#0f2f25]">Group 1</strong>McIlroy, Fowler, Burns, Finau</div>
                          <div className="border border-[#d8cab0] bg-[#fbf7ed] p-2"><strong className="block text-[#0f2f25]">Group 2</strong>Scheffler, Lowry, Hovland, Cantlay</div>
                          <div className="border border-[#d8cab0] bg-[#fbf7ed] p-2"><strong className="block text-[#0f2f25]">Group 3</strong>Schauffele, Fleetwood, Rahm, Morikawa</div>
                        </div>
                      </>
                    )}
                    <p>Groups are not locked yet when you create the pool. They auto-lock Tuesday morning of tournament week when the field is available. You can also lock groups sooner once the official field is posted.</p>
                  </div>
                </details>
              </div>
            )}
          </div>

          {gameFormat === 'standard' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberStepper label="Golfers to Pick" value={pickCount} onChange={setPickCount} min={1} max={30} fallback={12} />
              <NumberStepper label="Scores to Count" value={countScores} onChange={setCountScores} min={1} max={toNumber(pickCount, 12)} fallback={8} />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <NumberStepper label={gameFormat === 'ranked_groups' ? 'Tiers' : 'Groups'} value={groupCount} onChange={setGroupCount} min={2} max={12} fallback={6} />
              <NumberStepper label={gameFormat === 'ranked_groups' ? 'Picks per Tier' : 'Picks per Group'} value={picksPerGroup} onChange={setPicksPerGroup} min={1} max={6} fallback={2} />
              <NumberStepper label="Scores to Count" value={countScores} onChange={setCountScores} min={1} max={toNumber(pickCount, 12)} fallback={8} />
              <div className="border border-[#d8cab0] bg-[#fbf7ed] px-3 py-2 text-sm font-bold text-[#123c2f] sm:col-span-3">
                Total picks: {toNumber(groupCount, 6) * toNumber(picksPerGroup, 2)} · default is 6 {gameFormat === 'ranked_groups' ? 'tiers' : 'groups'}, 2 per {gameFormat === 'ranked_groups' ? 'tier' : 'group'}, best 8 count.
              </div>
            </div>
          )}

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
