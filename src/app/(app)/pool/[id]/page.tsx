export const runtime = 'edge';
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PoolView from './PoolView'

export default async function PoolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirect=${encodeURIComponent(`/pool/${id}`)}`)

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

  // Get all entries for this pool so the board/counts update as soon as people join.
  // Before lock/start, mask other entrants' golfer picks before sending data to the client.
  const entriesQuery = supabase
    .from('gpp_entries')
    .select('*')
    .eq('pool_id', id)

  const { data: entries } = await entriesQuery.order('created_at', { ascending: true })

  const safeEntries = (entries || []).map(entry => {
    const submittedPickCount = Array.isArray(entry.golfer_picks) ? entry.golfer_picks.length : 0
    if (picksAreVisible || entry.user_id === user.id) return entry
    return {
      ...entry,
      submitted_pick_count: submittedPickCount,
      golfer_picks: [],
      picks_hidden: true,
    }
  })

  // Get current user's entry
  const myEntry = safeEntries.find(e => e.user_id === user.id && !e.is_removed) || null

  return (
    <PoolView
      pool={pool}
      tournament={tournament}
      entries={safeEntries}
      myEntry={myEntry}
      isOwner={isOwner}
      userId={user.id}
    />
  )
}
