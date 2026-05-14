export const runtime = 'edge';
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PoolView from './PoolView'
import { buildPreviousPlayerCandidates, summarizeInviteStatuses } from '@/lib/pool-invite-logic'

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

  let previousPlayerCandidates: { userId: string; displayName: string }[] = []
  let inviteSummary = { pending: 0, accepted: 0, declined: 0 }

  if (isOwner) {
    const { data: ownedPools } = await supabase
      .from('gpp_pools')
      .select('id')
      .eq('owner_id', user.id)

    const previousPoolIds = (ownedPools || [])
      .map(item => item.id)
      .filter(poolId => poolId !== id)

    const { data: previousEntries } = previousPoolIds.length
      ? await supabase
        .from('gpp_entries')
        .select('user_id, display_name')
        .in('pool_id', previousPoolIds)
        .eq('is_removed', false)
      : { data: [] }

    const { data: poolInvites } = await supabase
      .from('gpp_pool_invites')
      .select('invited_user_id, status')
      .eq('pool_id', id)

    const currentPoolEntryUserIds = (entries || [])
      .filter(entry => entry.user_id && !entry.is_removed)
      .map(entry => entry.user_id as string)

    previousPlayerCandidates = buildPreviousPlayerCandidates({
      previousEntries: previousEntries || [],
      currentPoolEntryUserIds,
      existingInviteUserIds: (poolInvites || []).map(invite => invite.invited_user_id),
      ownerUserId: user.id,
    })
    inviteSummary = summarizeInviteStatuses(poolInvites || [])
  }

  return (
    <PoolView
      pool={pool}
      tournament={tournament}
      entries={safeEntries}
      myEntry={myEntry}
      isOwner={isOwner}
      userId={user.id}
      previousPlayerCandidates={previousPlayerCandidates}
      inviteSummary={inviteSummary}
    />
  )
}
