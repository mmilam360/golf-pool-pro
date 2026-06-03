'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { BackButton } from '@/components/BackButton'
import { createClient } from '@/lib/supabase/client'
import { trackGppEvent } from '@/lib/posthog-events'
import { useRouter } from 'next/navigation'
import { compareGolfersByListName, golferFullName, golferListNameFromParts } from '@/lib/golfer-display'

type JoinStep = 'code' | 'name' | 'picks' | 'saved'

type JoinPayload = {
  pool: {
    id: string
    name: string
    passcode: string
    pick_count: number
    count_scores: number
    is_locked: boolean
    game_format?: string
    picks_per_group?: number
    pick_groups_json?: PickGroup[]
    groups_finalized_at?: string | null
  }
  tournament: {
    name: string
    start_date: string
    status: string
    field_json?: GolfPlayer[]
  }
}

type GolfPlayer = { name?: string; firstName?: string; lastName?: string; worldRank?: number | null }
type PickGroup = { label: string; players: GolfPlayer[] }
type SavedEntry = { entry_id: string; pool_id: string; leaderboard_path: string; claim_path: string }

function playerName(player: GolfPlayer) {
  return golferFullName(player)
}

function createClaimToken() {
  const bytes = new Uint8Array(24)
  window.crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

function safeClaimParam(value: string) {
  const match = value.match(/^([0-9a-f-]{36})\.([A-Fa-f0-9]{48,})$/)
  return match ? { entryId: match[1], token: match[2] } : null
}

export default function JoinPoolPage() {
  const [step, setStep] = useState<JoinStep>('code')
  const [passcode, setPasscode] = useState('')
  const [entryName, setEntryName] = useState('')
  const [payload, setPayload] = useState<JoinPayload | null>(null)
  const [picks, setPicks] = useState<string[]>([])
  const [savedEntry, setSavedEntry] = useState<SavedEntry | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const autoJoinAttempted = useRef(false)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const pool = payload?.pool
  const tournament = payload?.tournament
  const groupedFormat = pool?.game_format === 'ranked_groups' || pool?.game_format === 'random_groups'
  const groups = groupedFormat && Array.isArray(pool?.pick_groups_json) ? pool.pick_groups_json : []
  const field = Array.isArray(tournament?.field_json) ? tournament.field_json : []
  const requiredPickCount = groupedFormat
    ? groups.length * Number(pool?.picks_per_group || 0)
    : Number(pool?.pick_count || 0)
  const canSave = requiredPickCount > 0 && picks.length === requiredPickCount
  const leaderboardUrl = savedEntry && typeof window !== 'undefined'
    ? `${window.location.origin}${savedEntry.leaderboard_path}`
    : ''
  const claimRedirect = savedEntry?.claim_path || ''
  const claimRedirectParam = claimRedirect ? encodeURIComponent(claimRedirect) : ''

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const claim = params.get('claim')
    if (claim) {
      void claimGuestEntry(claim)
      return
    }

    const code = params.get('code')
    const cleanedCode = code?.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    if (!cleanedCode) return

    setPasscode(cleanedCode)
    if (cleanedCode.length === 6 && !autoJoinAttempted.current) {
      autoJoinAttempted.current = true
      void loadPool(cleanedCode, 'qr')
    }
  }, [])

  async function claimGuestEntry(claim: string) {
    const parsed = safeClaimParam(claim)
    if (!parsed) {
      setError('This entry link is not valid.')
      return
    }

    setClaiming(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(`/pool/join?claim=${claim}`)}`)
      return
    }

    const { data, error } = await (supabase as any).rpc('gpp_claim_guest_entry', {
      p_entry_id: parsed.entryId,
      p_claim_token: parsed.token,
    })

    if (error) {
      setError(error.message || 'Could not link this entry.')
      setClaiming(false)
      return
    }

    const poolId = data?.pool_id
    router.replace(poolId ? `/pool/${poolId}?tab=my-entry` : '/dashboard')
  }

  async function loadPool(nextPasscode: string, source: 'manual' | 'qr') {
    const normalizedPasscode = nextPasscode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    setError('')
    setLoading(true)
    trackGppEvent('entry_started', {
      has_passcode: normalizedPasscode.length === 6,
      passcode_prefilled: source === 'qr',
      guest_flow: true,
    })

    if (normalizedPasscode.length < 6) {
      setError('Enter the full pool code from your host.')
      setLoading(false)
      return
    }

    const { data, error } = await (supabase as any).rpc('gpp_guest_join_payload', {
      p_passcode: normalizedPasscode,
    })

    setLoading(false)
    if (error || !data) {
      setError(error?.message || 'Invalid passcode. Check with the pool host.')
      return
    }

    const nextPayload = data as JoinPayload
    const picksClosed = nextPayload.pool.is_locked || nextPayload.tournament.status === 'live' || nextPayload.tournament.status === 'completed'
    if (picksClosed) {
      setError('This pool is locked. Picks have closed.')
      return
    }

    setPayload(nextPayload)
    setPasscode(normalizedPasscode)
    setStep('name')
  }

  async function saveGuestEntry() {
    if (!payload || !canSave || loading) return
    const trimmedName = entryName.trim()
    if (!trimmedName) {
      setError('Enter an entry name.')
      setStep('name')
      return
    }

    setError('')
    setLoading(true)
    const claimToken = createClaimToken()
    const { data, error } = await (supabase as any).rpc('gpp_create_guest_entry', {
      p_passcode: passcode,
      p_display_name: trimmedName,
      p_golfer_picks: picks,
      p_claim_token: claimToken,
    })

    setLoading(false)
    if (error || !data) {
      setError(error?.message || 'Could not save picks.')
      return
    }

    const nextSaved = data as SavedEntry
    setSavedEntry(nextSaved)
    setStep('saved')
    trackGppEvent('entry_submitted', {
      pool_id: payload.pool.id,
      entry_source: 'guest_join',
      pick_count: picks.length,
    })
  }

  function togglePick(name: string) {
    if (step !== 'picks') return
    setPicks(current => {
      if (current.includes(name)) return current.filter(pick => pick !== name)
      if (current.length >= requiredPickCount) return current
      return [...current, name]
    })
  }

  function groupPickCount(group: PickGroup) {
    return group.players.filter(player => picks.includes(playerName(player))).length
  }

  function canToggleGroupedPick(group: PickGroup, name: string) {
    if (!groupedFormat) return true
    if (picks.includes(name)) return true
    return groupPickCount(group) < Number(pool?.picks_per_group || 0)
  }

  const handlePasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await loadPool(passcode, 'manual')
  }

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!entryName.trim()) {
      setError('Enter an entry name.')
      return
    }
    setError('')
    setStep('picks')
  }

  async function copyLeaderboardLink() {
    if (!leaderboardUrl) return
    await navigator.clipboard.writeText(leaderboardUrl)
  }

  if (claiming) {
    return (
      <div className="mx-auto max-w-xl rounded-none border-2 border-[#123c2f] bg-white p-6 shadow-[6px_6px_0_#d8cab0]">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-[#8a6724]">Linking entry</p>
        <h1 className="mt-2 font-display text-3xl font-black uppercase tracking-[-0.03em] text-[#0f2f25]">Hang tight</h1>
        <p className="mt-3 text-stone-600">We’re linking this entry to your account.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <BackButton />
      <div className="mb-6">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Player entry</p>
        <h1 className="font-display text-4xl font-black uppercase tracking-[-0.04em] text-emerald-950">Join a pool</h1>
        <p className="mt-3 max-w-xl leading-7 text-stone-600">Enter the pool code, add your entry name, make every pick, and save. You can create an account after your picks are in.</p>
      </div>

      {error && <div className="mb-4 rounded-none border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}

      {step === 'code' && (
        <form onSubmit={handlePasscodeSubmit} className="space-y-5 rounded-none border-2 border-[#123c2f] bg-white p-6 shadow-[6px_6px_0_#d8cab0]">
          <div>
            <label className="mb-2 block text-sm font-bold text-stone-700">Pool passcode</label>
            <button
              type="button"
              onClick={() => inputRef.current?.focus()}
              className="grid w-full grid-cols-6 gap-2"
              aria-label="Enter pool passcode"
            >
              {Array.from({ length: 6 }, (_, index) => (
                <span key={index} className="grid h-14 place-items-center border-2 border-[#123c2f] bg-[#fbf7ed] font-mono text-2xl font-black text-[#123c2f]">
                  {passcode[index] || '-'}
                </span>
              ))}
            </button>
            <input
              ref={inputRef}
              type="text"
              value={passcode}
              onChange={e => setPasscode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              required
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              className="sr-only"
            />
          </div>
          <button type="submit" disabled={loading || passcode.length < 6} className="gpp-3d gpp-button-3d gpp-button-wrap w-full disabled:opacity-50">
            <span className="gpp-button-face py-3">{loading ? 'Opening pool...' : 'Continue'}</span>
          </button>
        </form>
      )}

      {step === 'name' && payload && (
        <form onSubmit={handleNameSubmit} className="space-y-5 rounded-none border-2 border-[#123c2f] bg-white p-6 shadow-[6px_6px_0_#d8cab0]">
          <div className="border-b border-stone-200 pb-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8a6724]">{tournament?.name}</p>
            <h2 className="mt-1 text-2xl font-black text-[#0f2f25]">{pool?.name}</h2>
            <p className="mt-2 text-sm text-stone-600">{requiredPickCount} picks. Top {pool?.count_scores} count.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-stone-700">Entry name</label>
            <input
              value={entryName}
              onChange={e => setEntryName(e.target.value)}
              maxLength={80}
              required
              autoFocus
              placeholder="Name, nickname, or team name"
              className="w-full rounded-none border-2 border-[#123c2f] bg-[#fbf7ed] px-4 py-3 text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#d8cab0]"
            />
            <p className="mt-2 text-sm text-stone-600">This is how you’ll show up on the leaderboard.</p>
          </div>
          <button type="submit" className="gpp-3d gpp-button-3d gpp-button-wrap w-full">
            <span className="gpp-button-face py-3">Continue to picks</span>
          </button>
        </form>
      )}

      {step === 'picks' && payload && (
        <div className="space-y-5">
          <div className="rounded-none border-2 border-[#123c2f] bg-white p-5 shadow-[6px_6px_0_#d8cab0]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8a6724]">{entryName}</p>
                <h2 className="mt-1 text-2xl font-black text-[#0f2f25]">Make your picks</h2>
                <p className="mt-2 text-sm font-semibold text-stone-700">{picks.length}/{requiredPickCount} selected</p>
              </div>
              <button
                type="button"
                onClick={saveGuestEntry}
                disabled={!canSave || loading}
                className="gpp-3d gpp-button-3d gpp-button-wrap disabled:opacity-50"
              >
                <span className="gpp-button-face px-5 py-3">{loading ? 'Saving...' : canSave ? 'Save picks' : `Pick ${requiredPickCount} golfers to save`}</span>
              </button>
            </div>
            <p className="mt-4 border-t border-stone-200 pt-3 text-sm font-semibold text-stone-700">Guest picks can’t be edited after saving. Make sure your card is complete before you submit.</p>
          </div>

          {groupedFormat ? (
            groups.length > 0 ? (
              <div className="space-y-4">
                {groups.map(group => (
                  <section key={group.label} className="bg-transparent">
                    <div className="mb-2 flex w-fit max-w-full items-center justify-between gap-3 border-b border-[#d8cab0] pb-1 pr-2">
                      <h3 className="font-black uppercase tracking-[-0.02em] text-[#0f2f25]">{group.label}</h3>
                      <span className="text-xs font-black uppercase tracking-[0.12em] text-[#8a6724]">{groupPickCount(group)}/{pool?.picks_per_group}</span>
                    </div>
                    <div className="inline-flex w-max max-w-full flex-col overflow-hidden border-y border-[#d8cab0] bg-white">
                      {[...group.players].sort(compareGolfersByListName).map(player => {
                        const name = playerName(player)
                        const selected = picks.includes(name)
                        const disabled = !canToggleGroupedPick(group, name)
                        const pickNumber = picks.indexOf(name) + 1
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => togglePick(name)}
                            disabled={disabled}
                            className={`flex w-full min-w-[14rem] max-w-full items-center justify-between gap-4 border-x border-b border-[#d8cab0] px-3 py-2 text-left text-sm font-bold last:border-b-0 ${selected ? 'bg-[#123c2f] text-white' : 'bg-white text-stone-800 hover:bg-[#fbf7ed]'} disabled:cursor-not-allowed disabled:opacity-45`}
                          >
                            <span className="truncate pr-2">{golferListNameFromParts(player)}</span>
                            {selected ? <span className="shrink-0 border border-white/80 bg-white px-1.5 py-0.5 text-[10px] font-black text-[#123c2f]">{pickNumber}/{requiredPickCount}</span> : null}
                          </button>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="rounded-none border-2 border-[#123c2f] bg-white p-5 text-sm font-semibold text-stone-700 shadow-[4px_4px_0_#d8cab0]">Picks open after groups lock.</div>
            )
          ) : (
            <div className="inline-flex w-max max-w-full flex-col overflow-hidden border-y border-[#d8cab0] bg-white">
              {[...field].sort(compareGolfersByListName).map(player => {
                const name = playerName(player)
                const selected = picks.includes(name)
                const disabled = !selected && picks.length >= requiredPickCount
                const pickNumber = picks.indexOf(name) + 1
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => togglePick(name)}
                    disabled={disabled}
                    className={`flex w-full min-w-[14rem] max-w-full items-center justify-between gap-4 border-x border-b border-[#d8cab0] px-3 py-2 text-left text-sm font-bold last:border-b-0 ${selected ? 'bg-[#123c2f] text-white' : 'bg-white text-stone-800 hover:bg-[#fbf7ed]'} disabled:cursor-not-allowed disabled:opacity-45`}
                  >
                    <span className="truncate pr-2">{golferListNameFromParts(player)}</span>
                    {selected ? <span className="shrink-0 border border-white/80 bg-white px-1.5 py-0.5 text-[10px] font-black text-[#123c2f]">{pickNumber}/{requiredPickCount}</span> : null}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {step === 'saved' && savedEntry && (
        <div className="rounded-none border-2 border-[#123c2f] bg-white p-6 shadow-[6px_6px_0_#d8cab0]">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8a6724]">Picks saved</p>
          <h2 className="mt-1 font-display text-3xl font-black uppercase tracking-[-0.04em] text-[#0f2f25]">You’re in</h2>
          <p className="mt-3 text-stone-700">Save the leaderboard link so you can follow your entry during the tournament.</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link href={savedEntry.leaderboard_path} className="gpp-3d gpp-button-3d gpp-button-wrap text-center">
              <span className="gpp-button-face px-5 py-3">View leaderboard</span>
            </Link>
            <button type="button" onClick={copyLeaderboardLink} className="border-2 border-[#123c2f] bg-[#fbf7ed] px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-[#123c2f]">
              Copy leaderboard link
            </button>
          </div>
          <div className="mt-6 border-t border-stone-200 pt-5">
            <h3 className="text-lg font-black text-[#0f2f25]">Want this saved to your account?</h3>
            <p className="mt-2 text-sm leading-6 text-stone-700">Create account to link entry, get a quick My Entry view, edit picks before lock, see pool history, re-enter faster next time, and run your own pools.</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Link href={`/signup?redirect=${claimRedirectParam}`} className="border-2 border-[#123c2f] bg-[#123c2f] px-5 py-3 text-center text-sm font-black uppercase tracking-[0.12em] text-white">Create account to link entry</Link>
              <Link href={`/login?redirect=${claimRedirectParam}`} className="border-2 border-[#123c2f] bg-white px-5 py-3 text-center text-sm font-black uppercase tracking-[0.12em] text-[#123c2f]">Sign in to link entry</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
