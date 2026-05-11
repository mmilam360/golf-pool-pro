'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function JoinPoolPage() {
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    if (code) setPasscode(code.toUpperCase())
  }, [])

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setLoading(false); return }

    // Find pool by passcode
    const { data: pool, error: poolError } = await supabase
      .from('gpp_pools')
      .select('id, is_locked')
      .eq('passcode', passcode.toUpperCase())
      .single()

    if (poolError || !pool) {
      setError('Invalid passcode. Check with the pool host.')
      setLoading(false); return
    }

    if (pool.is_locked) {
      setError('This pool is locked. Picks have closed.')
      setLoading(false); return
    }

    // Check if already joined
    const { data: existing } = await supabase
      .from('gpp_entries')
      .select('id')
      .eq('pool_id', pool.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      // Already in, go to pool
      router.push(`/pool/${pool.id}`)
      return
    }

    // Get display name
    const { data: profile } = await supabase
      .from('gpp_profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()

    // Create entry
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
      router.push(`/pool/${pool.id}`)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-3xl font-bold mb-8">Join a Pool</h1>
      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm border border-red-200">{error}</div>}

      <form onSubmit={handleJoin} className="space-y-6 bg-white rounded-xl p-6 border border-stone-200 shadow-sm">
        <div>
          <label className="block text-stone-700 text-sm font-medium mb-1">Pool Passcode</label>
          <input
            type="text"
            value={passcode}
            onChange={e => setPasscode(e.target.value.toUpperCase())}
            required
            maxLength={8}
            placeholder="Enter the 6-character passcode"
            className="w-full bg-white border border-stone-300 rounded-lg px-4 py-3 text-stone-900 text-center text-2xl font-mono tracking-widest focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        <button
          type="submit"
          disabled={loading || passcode.length < 4}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Joining...' : 'Join Pool'}
        </button>
      </form>
    </div>
  )
}
