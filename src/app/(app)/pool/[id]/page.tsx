export const runtime = 'edge';
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PoolView from './PoolView'

export default async function PoolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get pool with tournament
  const { data: pool } = await supabase
    .from('gpp_pools')
    .select('*, gpp_tournaments(*)')
    .eq('id', id)
    .single()

  if (!pool) redirect('/dashboard')

  const tournament = pool.gpp_tournaments as any
  const isOwner = pool.owner_id === user.id
  const scoringIsLive = tournament?.status === 'live' || tournament?.status === 'completed'
  const picksAreVisible = pool.is_locked || scoringIsLive

  // Get visible entries for this pool. Before lock/start, entrants only receive their own picks.
  let entriesQuery = supabase
    .from('gpp_entries')
    .select('*')
    .eq('pool_id', id)

  if (!picksAreVisible) {
    entriesQuery = entriesQuery.eq('user_id', user.id)
  }

  const { data: entries } = await entriesQuery.order('created_at', { ascending: true })

  // Get current user's entry
  const myEntry = entries?.find(e => e.user_id === user.id && !e.is_removed) || null

  return (
    <PoolView
      pool={pool}
      tournament={tournament}
      entries={entries || []}
      myEntry={myEntry}
      isOwner={isOwner}
      userId={user.id}
    />
  )
}
