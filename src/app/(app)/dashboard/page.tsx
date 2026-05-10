import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get user's pools (owned and joined)
  const { data: ownedPools } = await supabase
    .from('gpp_pools')
    .select('id, name, passcode, is_locked, is_completed, buy_in_amount, gpp_tournaments(name, start_date, status)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  const { data: entries } = await supabase
    .from('gpp_entries')
    .select('id, pool_id, display_name, golfer_picks, is_removed, gpp_pools(name, passcode, is_locked, is_completed, buy_in_amount, gpp_tournaments(name, start_date, status))')
    .eq('user_id', user.id)
    .eq('is_removed', false)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex gap-3">
          <Link
            href="/pool/create"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-2 rounded-lg transition-colors text-sm"
          >
            Create Pool
          </Link>
          <Link
            href="/pool/join"
            className="bg-zinc-800 hover:bg-zinc-700 text-white font-semibold px-5 py-2 rounded-lg transition-colors text-sm"
          >
            Join Pool
          </Link>
        </div>
      </div>

      {/* Owned Pools */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4 text-zinc-300">Your Pools</h2>
        {!ownedPools?.length ? (
          <div className="bg-zinc-900 rounded-xl p-8 border border-zinc-800 text-center">
            <p className="text-zinc-500">You haven't created any pools yet.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {ownedPools.map(pool => {
              const t = pool.gpp_tournaments as any
              return (
                <Link key={pool.id} href={`/pool/${pool.id}`}
                  className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 hover:border-zinc-600 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-lg">{pool.name}</h3>
                    {pool.is_locked && <span className="text-xs bg-zinc-700 px-2 py-1 rounded">Locked</span>}
                    {pool.is_completed && <span className="text-xs bg-emerald-900 text-emerald-300 px-2 py-1 rounded">Final</span>}
                  </div>
                  <p className="text-zinc-400 text-sm">{t?.name || 'Tournament'}</p>
                  <p className="text-zinc-500 text-xs mt-1">
                    Passcode: <span className="text-emerald-400 font-mono">{pool.passcode}</span>
                    {pool.buy_in_amount > 0 && <span className="ml-3">${pool.buy_in_amount} buy-in</span>}
                  </p>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Joined Pools */}
      <section>
        <h2 className="text-xl font-semibold mb-4 text-zinc-300">Pools You've Joined</h2>
        {!entries?.length ? (
          <div className="bg-zinc-900 rounded-xl p-8 border border-zinc-800 text-center">
            <p className="text-zinc-500">You haven't joined any pools yet.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {entries.map(entry => {
              const pool = entry.gpp_pools as any
              const t = pool?.gpp_tournaments as any
              const picks = (entry.golfer_picks as string[]) || []
              return (
                <Link key={entry.id} href={`/pool/${pool?.id}`}
                  className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 hover:border-zinc-600 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{pool?.name || 'Pool'}</h3>
                    {pool?.is_completed && <span className="text-xs bg-emerald-900 text-emerald-300 px-2 py-1 rounded">Final</span>}
                  </div>
                  <p className="text-zinc-400 text-sm">{t?.name || 'Tournament'}</p>
                  <p className="text-zinc-500 text-xs mt-1">
                    {picks.length > 0 ? `${picks.length} golfers picked` : 'No picks yet'}
                  </p>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
