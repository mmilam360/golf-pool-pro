'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BackButton } from '@/components/BackButton'
import { createClient } from '@/lib/supabase/client'
import { trackGppEvent } from '@/lib/posthog-events'
import { useRouter } from 'next/navigation'

type ResumeEntry = { poolId: string; token: string; poolName: string; tournamentName: string; displayName: string }

export default function JoinPoolPage() {
  const [passcode, setPasscode] = useState('')
  const [guestName, setGuestName] = useState('')
  const [resumeEntry, setResumeEntry] = useState<ResumeEntry | null>(null)
  const [showBackButton, setShowBackButton] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [signedInAccountName, setSignedInAccountName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    const cleanedCode = code?.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    try {
      const referrerUrl = document.referrer ? new URL(document.referrer) : null
      setShowBackButton(Boolean(referrerUrl && referrerUrl.origin === window.location.origin && !cleanedCode))
    } catch {
      setShowBackButton(false)
    }
    if (!cleanedCode) return

    setPasscode(cleanedCode)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadAccountName() {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return

      if (!user) {
        setIsSignedIn(false)
        setAuthChecked(true)
        return
      }

      const { data: profile } = await supabase
        .from('gpp_profiles')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle()

      if (cancelled) return
      const accountName = profile?.display_name?.trim() || user.email?.split('@')[0] || ''
      setIsSignedIn(true)
      setSignedInAccountName(accountName)
      setGuestName(current => current.trim() ? current : accountName)
      setAuthChecked(true)
    }

    void loadAccountName()

    return () => {
      cancelled = true
    }
  }, [supabase])

  useEffect(() => {
    const normalizedPasscode = passcode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    if (normalizedPasscode.length !== 6) {
      setResumeEntry(null)
      return
    }

    let cancelled = false
    fetch(`/api/pool/guest-entry?passcode=${encodeURIComponent(normalizedPasscode)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled || !data?.poolId || data.picksClosed) {
          if (!cancelled) setResumeEntry(null)
          return
        }
        const stored = window.localStorage.getItem(`gpp_guest_entry:${data.poolId}`)
        if (!stored) {
          setResumeEntry(null)
          return
        }
        try {
          const parsed = JSON.parse(stored)
          if (parsed?.token) {
            setResumeEntry({
              poolId: data.poolId,
              token: parsed.token,
              poolName: data.poolName || 'this pool',
              tournamentName: data.tournamentName || '',
              displayName: parsed.displayName || 'Your entry',
            })
          } else {
            setResumeEntry(null)
          }
        } catch {
          setResumeEntry(null)
        }
      })
      .catch(() => {
        if (!cancelled) setResumeEntry(null)
      })

    return () => {
      cancelled = true
    }
  }, [passcode])

  async function joinPool(nextPasscode: string, source: 'manual' | 'qr') {
    const normalizedPasscode = nextPasscode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    setError('')
    setLoading(true)
    trackGppEvent('entry_started', {
      has_passcode: normalizedPasscode.length === 6,
      passcode_prefilled: source === 'qr',
    })

    if (normalizedPasscode.length < 6) {
      setError('Enter the full pool code from your host.')
      setLoading(false)
      return
    }

    const displayName = guestName.trim().replace(/\s+/g, ' ')
    if (!displayName) {
      setError('Enter the name you want on the leaderboard.')
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      const res = await fetch('/api/pool/guest-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: normalizedPasscode, displayName }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not join this pool.')
        setLoading(false)
        return
      }
      window.localStorage.setItem(`gpp_guest_entry:${data.poolId}`, JSON.stringify({ entryId: data.entryId, token: data.token, displayName }))
      trackGppEvent('entry_submitted', {
        pool_id: data.poolId,
        entry_source: source === 'qr' ? 'qr_code_guest' : 'passcode_guest',
      })
      router.push(`/pool/${data.poolId}?guest=${encodeURIComponent(data.token)}`)
      return
    }

    const { data: pool, error: poolError } = await supabase
      .from('gpp_pools')
      .select('id, is_locked, gpp_tournaments(status, start_date)')
      .eq('passcode', normalizedPasscode)
      .single()

    if (poolError || !pool) {
      setError('Invalid passcode. Check with the pool host.')
      setLoading(false); return
    }

    const tournament = Array.isArray((pool as any).gpp_tournaments)
      ? (pool as any).gpp_tournaments[0]
      : (pool as any).gpp_tournaments
    const picksClosed = pool.is_locked || tournament?.status === 'live' || tournament?.status === 'completed'

    if (picksClosed) {
      setError('This pool is locked. Picks have closed.')
      setLoading(false); return
    }

    const { data: existingEntries } = await supabase
      .from('gpp_entries')
      .select('id, is_removed')
      .eq('pool_id', pool.id)
      .eq('user_id', user.id)

    const existing = (existingEntries || []).find(entry => !entry.is_removed)
    if (existing) {
      router.push(`/pool/${pool.id}`)
      return
    }

    const { error: insertError } = await supabase
      .from('gpp_entries')
      .insert({
        pool_id: pool.id,
        user_id: user.id,
        display_name: displayName,
        golfer_picks: [],
      })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
    } else {
      trackGppEvent('entry_submitted', {
        pool_id: pool.id,
        entry_source: source === 'qr' ? 'qr_code' : 'passcode',
      })
      router.push(`/pool/${pool.id}`)
    }
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    await joinPool(passcode, 'manual')
  }

  function loginHref() {
    const normalizedPasscode = passcode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    const redirect = normalizedPasscode.length === 6 ? `/pool/join?code=${normalizedPasscode}` : '/pool/join'
    return `/login?redirect=${encodeURIComponent(redirect)}`
  }

  const showAccountSignIn = authChecked && !isSignedIn
  const nameRequired = authChecked && !isSignedIn

  return (
    <div className="mx-auto max-w-xl">
      <div>
        {showBackButton && <BackButton />}
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Player entry</p>
        <h1 className="mb-4 font-display text-4xl font-bold tracking-[-0.03em] text-emerald-950">Join a pool</h1>
        {error && <div className="mb-4 rounded-none border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {resumeEntry && (
          <div className="mb-4 border-2 border-[#123c2f] bg-[#fbf7ed] p-4 shadow-[5px_5px_0_#d8cab0]">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8a6724]">Entry found</p>
            <h2 className="mt-1 text-lg font-black text-[#123c2f]">Continue {resumeEntry.displayName}</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-stone-600">
              {resumeEntry.poolName}{resumeEntry.tournamentName ? ` · ${resumeEntry.tournamentName}` : ''}
            </p>
            <button
              type="button"
              onClick={() => router.push(`/pool/${resumeEntry.poolId}?guest=${encodeURIComponent(resumeEntry.token)}`)}
              className="mt-3 border-2 border-[#123c2f] bg-[#123c2f] px-4 py-2 text-sm font-black text-white hover:bg-[#0f2f25]"
            >
              Make Picks
            </button>
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-5 rounded-none border-2 border-[#123c2f] bg-white p-6 shadow-[6px_6px_0_#d8cab0]">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Pool passcode</label>
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
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">
              Name on leaderboard{' '}
              {nameRequired && <span className="ml-2 text-xs font-semibold text-amber-700">required</span>}
            </label>
            <input
              type="text"
              value={guestName}
              onChange={e => setGuestName(e.target.value.slice(0, 60))}
              placeholder="Name for the leaderboard"
              maxLength={60}
              autoComplete="name"
              required={nameRequired}
              aria-required={nameRequired}
              onInvalid={e => e.currentTarget.setCustomValidity('Enter the name you want on the leaderboard.')}
              onInput={e => e.currentTarget.setCustomValidity('')}
              className="w-full rounded-none border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
            {signedInAccountName && (
              <p className="mt-2 text-xs font-semibold text-stone-500">Using your account name. You can change it for this pool.</p>
            )}
          </div>
          <div className="grid gap-3">
            <button
              type="submit"
              disabled={loading || passcode.length < 6 || !authChecked}
              className="gpp-3d gpp-button-3d gpp-button-wrap w-full disabled:opacity-50"
            >
              <span className="gpp-button-face py-3">{loading ? 'Opening picks...' : 'Make Picks'}</span>
            </button>
            {showAccountSignIn && (
              <>
                <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.16em] text-stone-500">
                  <span className="h-px flex-1 bg-[#d8cab0]" />
                  <span>or</span>
                  <span className="h-px flex-1 bg-[#d8cab0]" />
                </div>
                <a
                  href={loginHref()}
                  className="border border-[#d8cab0] bg-white px-4 py-3 text-center text-sm font-semibold text-[#123c2f] hover:border-[#123c2f] hover:bg-[#fbf7ed]"
                >
                  Account sign in
                </a>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
