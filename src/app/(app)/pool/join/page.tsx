'use client'
import { useEffect, useRef, useState } from 'react'
import { BackButton } from '@/components/BackButton'
import { createClient } from '@/lib/supabase/client'
import { trackGppEvent } from '@/lib/posthog-events'
import { useRouter } from 'next/navigation'

export default function JoinPoolPage() {
  const [passcode, setPasscode] = useState('')
  const [guestName, setGuestName] = useState('')
  const [notificationEmail, setNotificationEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    const cleanedCode = code?.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    if (!cleanedCode) return

    setPasscode(cleanedCode)
  }, [])

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

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      const displayName = guestName.trim().replace(/\s+/g, ' ')
      const email = notificationEmail.trim()
      if (!displayName) {
        setError('Enter the name you want on the leaderboard.')
        setLoading(false)
        return
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('Enter a valid email address or leave it blank.')
        setLoading(false)
        return
      }

      const res = await fetch('/api/pool/guest-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: normalizedPasscode, displayName, notificationEmail: email || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not join this pool.')
        setLoading(false)
        return
      }
      window.localStorage.setItem(`gpp_guest_entry:${data.poolId}`, JSON.stringify({ entryId: data.entryId, token: data.token }))
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

    const { data: existing } = await supabase
      .from('gpp_entries')
      .select('id')
      .eq('pool_id', pool.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      router.push(`/pool/${pool.id}`)
      return
    }

    const { data: profile } = await supabase
      .from('gpp_profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()

    const { error: insertError } = await supabase
      .from('gpp_entries')
      .insert({
        pool_id: pool.id,
        user_id: user.id,
        display_name: profile?.display_name || user.email?.split('@')[0] || 'Player',
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

  return (
    <div className="mx-auto max-w-xl">
      <div>
        <BackButton />
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Player entry</p>
        <h1 className="mb-4 font-display text-4xl font-bold tracking-[-0.03em] text-emerald-950">Join a Pool</h1>
        <p className="mb-6 max-w-md leading-7 text-stone-600">Scan a pool poster and we’ll open the pool for you. If your host gave you a code, enter it here.</p>
        {error && <div className="mb-4 rounded-none border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleJoin} className="space-y-5 rounded-none border-2 border-[#123c2f] bg-white p-6 shadow-[6px_6px_0_#d8cab0]">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Pool Passcode</label>
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
            <label className="mb-1 block text-sm font-medium text-stone-700">Name on leaderboard</label>
            <input
              type="text"
              value={guestName}
              onChange={e => setGuestName(e.target.value.slice(0, 60))}
              placeholder="Your name"
              maxLength={60}
              className="w-full rounded-none border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Email for final score updates <span className="text-stone-400">optional</span></label>
            <input
              type="email"
              value={notificationEmail}
              onChange={e => setNotificationEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full rounded-none border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
            <p className="mt-1 text-xs font-semibold text-stone-500">No account needed. We’ll only use this for pool updates.</p>
          </div>
          <button
            type="submit"
            disabled={loading || passcode.length < 6}
            className="gpp-3d gpp-button-3d gpp-button-wrap w-full disabled:opacity-50"
          >
            <span className="gpp-button-face py-3">{loading ? 'Joining...' : 'Join Pool'}</span>
          </button>
        </form>
      </div>
    </div>
  )
}
