export const runtime = 'edge';
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PoolView from './PoolView'
import { buildPreviousPlayerCandidates, summarizeInviteStatuses } from '@/lib/pool-invite-logic'

export default async function PoolPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ inviteFrom?: string; tab?: string; error?: string }> }) {
  const { id } = await params
  const query = searchParams ? await searchParams : {}
  const inviteFromPoolId = typeof query?.inviteFrom === 'string' ? query.inviteFrom : ''
  const requestedTab = typeof query?.tab === 'string' ? query.tab : ''
  const initialError = typeof query?.error === 'string' ? query.error : ''
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirect=${encodeURIComponent(`/pool/${id}`)}`)

  const [poolResult, entriesResult] = await Promise.all([
    supabase
      .from('gpp_pools')
      .select('*, gpp_tournaments(*)')
      .eq('id', id)
      .single(),
    supabase
      .from('gpp_entries')
      .select('*')
      .eq('pool_id', id)
      .order('created_at', { ascending: true }),
  ])
  const { data: pool } = poolResult
  const { data: entries } = entriesResult

  if (!pool) redirect('/dashboard')

  const tournament = pool.gpp_tournaments as any
  const isOwner = pool.owner_id === user.id
  const scoringIsLive = tournament?.status === 'live' || tournament?.status === 'completed'
  const picksAreVisible = pool.is_locked || scoringIsLive

  // Before lock/start, mask other entrants' golfer picks before sending data to the client.

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

  let previousPlayerCandidates: { userId: string; displayName: string; sourcePoolIds?: string[]; suggested?: boolean }[] = []
  let inviteSummary = { pending: 0, accepted: 0, declined: 0 }

  if (isOwner) {
    const [ownedPoolsResult, poolInvitesResult] = await Promise.all([
      supabase
        .from('gpp_pools')
        .select('id')
        .eq('owner_id', user.id),
      supabase
        .from('gpp_pool_invites')
        .select('invited_user_id, status')
        .eq('pool_id', id),
    ])
    const { data: ownedPools } = ownedPoolsResult
    const { data: poolInvites } = poolInvitesResult

    const previousPoolIds = (ownedPools || [])
      .map(item => item.id)
      .filter(poolId => poolId !== id)

    const { data: previousEntries } = previousPoolIds.length
      ? await supabase
        .from('gpp_entries')
        .select('pool_id, user_id, display_name')
        .in('pool_id', previousPoolIds)
        .eq('is_removed', false)
      : { data: [] }

    const currentPoolEntryUserIds = (entries || [])
      .filter(entry => entry.user_id && !entry.is_removed)
      .map(entry => entry.user_id as string)

    previousPlayerCandidates = buildPreviousPlayerCandidates({
      previousEntries: previousEntries || [],
      currentPoolEntryUserIds,
      existingInviteUserIds: (poolInvites || []).map(invite => invite.invited_user_id),
      ownerUserId: user.id,
    }).map(candidate => ({
      ...candidate,
      suggested: Boolean(inviteFromPoolId && candidate.sourcePoolIds?.includes(inviteFromPoolId)),
    })).sort((a, b) => Number(Boolean(b.suggested)) - Number(Boolean(a.suggested)) || a.displayName.localeCompare(b.displayName))
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
      initialTab={requestedTab === 'my-entry' ? 'my-entry' : isOwner && requestedTab === 'pool-settings' ? 'pool-settings' : undefined}
      initialError={initialError}
    />
  )
}
