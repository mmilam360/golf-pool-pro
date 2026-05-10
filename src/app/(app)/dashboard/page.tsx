export const runtime = 'edge';
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700 mb-2">Clubhouse</p>
          <h1 className="text-3xl font-bold text-emerald-950">Dashboard</h1>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/pool/create"
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-5 py-3 rounded-lg transition-colors text-sm text-center shadow-sm"
          >
            Create Pool
          </Link>
          <Link
            href="/pool/join"
            className="bg-white hover:bg-stone-50 text-emerald-900 font-semibold px-5 py-3 rounded-lg border border-stone-300 transition-colors text-sm text-center"
          >
            Join Pool
          </Link>
        </div>
      </div>

      {/* Owned Pools */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4 text-stone-900">Your Pools</h2>
        {!ownedPools?.length ? (
          <div className="bg-white rounded-lg p-8 border border-stone-200 text-center shadow-sm">
            <p className="text-stone-600">You haven't created any pools yet.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {ownedPools.map(pool => {
              const t = pool.gpp_tournaments as any
              return (
                <Link key={pool.id} href={`/pool/${pool.id}`}
                  className="bg-white rounded-lg p-5 border border-stone-200 hover:border-emerald-300 hover:shadow-sm transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-lg text-emerald-950">{pool.name}</h3>
                    {pool.is_locked && <span className="text-xs bg-stone-100 text-stone-700 px-2 py-1 rounded border border-stone-200">Locked</span>}
                    {pool.is_completed && <span className="text-xs bg-emerald-50 text-emerald-800 px-2 py-1 rounded border border-emerald-200">Final</span>}
                  </div>
                  <p className="text-stone-600 text-sm">{t?.name || 'Tournament'}</p>
                  <p className="text-stone-500 text-xs mt-2">
                    Passcode: <span className="text-emerald-800 font-mono font-semibold">{pool.passcode}</span>
                    {pool.buy_in_amount > 0 && <span className="ml-3 text-amber-800">${pool.buy_in_amount} buy-in</span>}
                  </p>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Joined Pools */}
      <section>
        <h2 className="text-xl font-semibold mb-4 text-stone-900">Pools You've Joined</h2>
        {!entries?.length ? (
          <div className="bg-white rounded-lg p-8 border border-stone-200 text-center shadow-sm">
            <p className="text-stone-600">You haven't joined any pools yet.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {entries.map(entry => {
              const pool = entry.gpp_pools as any
              const t = pool?.gpp_tournaments as any
              const picks = (entry.golfer_picks as string[]) || []
              return (
                <Link key={entry.id} href={`/pool/${pool?.id}`}
                  className="bg-white rounded-lg p-5 border border-stone-200 hover:border-emerald-300 hover:shadow-sm transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-emerald-950">{pool?.name || 'Pool'}</h3>
                    {pool?.is_completed && <span className="text-xs bg-emerald-50 text-emerald-800 px-2 py-1 rounded border border-emerald-200">Final</span>}
                  </div>
                  <p className="text-stone-600 text-sm">{t?.name || 'Tournament'}</p>
                  <p className="text-stone-500 text-xs mt-2">
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
