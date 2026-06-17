import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { findGuestEntryIdByToken, hashGuestEntryToken } from '@/lib/guest-entry'
import { redirect } from 'next/navigation'
import PoolView from './PoolView'
import GuestEntryLocalResume from '@/components/GuestEntryLocalResume'
import { buildPreviousPlayerCandidates, summarizeInviteStatuses } from '@/lib/pool-invite-logic'
import { hydrateFinalLeaderboard } from '@/lib/fresh-final-leaderboard'

export const runtime = 'nodejs'

export default async function PoolPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ inviteFrom?: string; guest?: string }> }) {
  const { id } = await params
  const query = searchParams ? await searchParams : {}
  const inviteFromPoolId = typeof query?.inviteFrom === 'string' ? query.inviteFrom : ''
  const guestToken = typeof query?.guest === 'string' ? query.guest : ''
  const hasGuestToken = Boolean(guestToken)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const dataSupabase = hasGuestToken ? createServiceClient() as any : supabase as any
  if (!user && !hasGuestToken) return <GuestEntryLocalResume poolId={id} />

  const [poolResult, entriesResult] = await Promise.all([
    dataSupabase
      .from('gpp_pools')
      .select('id, tournament_id, name, passcode, owner_id, pick_count, count_scores, ob_rule_enabled, ob_penalty_strokes, is_locked, lock_at, is_completed, payment_status, amount_paid_cents, game_format, group_count, picks_per_group, pick_groups_json, groups_finalized_at, gpp_tournaments(*)')
      .eq('id', id)
      .single(),
    dataSupabase
      .from('gpp_entries')
      .select('id, pool_id, user_id, display_name, golfer_picks, total_score, counting_scores, rank, has_paid, payout_amount, is_removed, removed_reason, removed_at, full_name, full_name_confirmed_at, notification_email, guest_entry_token_hash, created_at')
      .eq('pool_id', id)
      .order('created_at', { ascending: true }),
  ])
  const { data: pool } = poolResult
  const { data: entries } = entriesResult

  if (!pool) redirect('/dashboard')

  const tournament = await hydrateFinalLeaderboard(pool.gpp_tournaments as any)
  pool.gpp_tournaments = tournament
  const guestTokenHash = hasGuestToken ? hashGuestEntryToken(guestToken) : ''
  const tokenEntryId = hasGuestToken ? await findGuestEntryIdByToken(dataSupabase, guestToken) : null
  const guestEntry = hasGuestToken
    ? (entries || []).find((entry: any) => entry.guest_entry_token_hash === guestTokenHash && !entry.is_removed) || null
      || (tokenEntryId ? (entries || []).find((entry: any) => entry.id === tokenEntryId && !entry.is_removed && !entry.user_id) || null : null)
    : null
  if (hasGuestToken && !guestEntry) {
    const accountEntry = user
      ? (entries || []).find((entry: any) => entry.user_id === user.id && !entry.is_removed) || null
      : null
    if (accountEntry) redirect(`/pool/${id}`)
    redirect('/pool/join')
  }

  const usingGuestToken = Boolean(guestEntry)
  const isOwner = Boolean(user && pool.owner_id === user.id)
  const scoringIsLive = tournament?.status === 'live' || tournament?.status === 'completed'
  const picksAreVisible = pool.is_locked || scoringIsLive
  const withdrawnNames = new Set((Array.isArray(tournament?.field_json) ? tournament.field_json : [])
    .filter((player: any) => String(player?.status || '').toLowerCase() === 'wd')
    .map((player: any) => player.name)
    .filter(Boolean))

  // Before lock/start, mask other entrants' golfer picks before sending data to the client.

  let safeEntries = (entries || []).map(entry => {
    const submittedPickCount = Array.isArray(entry.golfer_picks) ? entry.golfer_picks.length : 0
    const withdrawnPicks = isOwner && withdrawnNames.size > 0 && Array.isArray(entry.golfer_picks)
      ? entry.golfer_picks.filter((name: string) => withdrawnNames.has(name))
      : []
    const ownerWdMeta = isOwner ? { withdrawn_picks: withdrawnPicks } : {}
    const currentEntry = Boolean((user && entry.user_id === user.id) || (guestEntry && entry.id === guestEntry.id))
    const privateMeta = isOwner || currentEntry
      ? {}
      : { user_id: null, full_name: null, full_name_confirmed_at: null, account_full_name: '', account_full_name_confirmed_at: null, notification_email: null, guest_entry_token_hash: null }
    if (picksAreVisible || currentEntry) return { ...entry, ...ownerWdMeta, ...privateMeta }
    return {
      ...entry,
      ...ownerWdMeta,
      ...privateMeta,
      submitted_pick_count: submittedPickCount,
      golfer_picks: [],
      picks_hidden: true,
    }
  })

  if (isOwner) {
    const accountUserIds = Array.from(new Set(safeEntries.map((entry: any) => entry.user_id).filter(Boolean)))
    const { data: profiles } = accountUserIds.length
      ? await (createServiceClient() as any)
        .from('gpp_profiles')
        .select('id, email, full_name, full_name_confirmed_at')
        .in('id', accountUserIds)
      : { data: [] }
    const emailByUserId = new Map((profiles || []).map((profile: any) => [profile.id, profile.email || '']))
    const fullNameByUserId = new Map((profiles || []).map((profile: any) => [profile.id, profile.full_name_confirmed_at ? profile.full_name || '' : '']))
    const fullNameConfirmedByUserId = new Map((profiles || []).map((profile: any) => [profile.id, profile.full_name_confirmed_at || null]))
    safeEntries = safeEntries.map((entry: any) => entry.user_id
      ? { ...entry, account_email: emailByUserId.get(entry.user_id) || '', account_full_name: fullNameByUserId.get(entry.user_id) || '', account_full_name_confirmed_at: fullNameConfirmedByUserId.get(entry.user_id) || null }
      : entry)
  } else if (user) {
    const { data: profile } = await (createServiceClient() as any)
      .from('gpp_profiles')
      .select('full_name, full_name_confirmed_at')
      .eq('id', user.id)
      .maybeSingle()
    safeEntries = safeEntries.map((entry: any) => entry.user_id === user.id
      ? { ...entry, account_full_name: profile?.full_name_confirmed_at ? profile?.full_name || '' : '', account_full_name_confirmed_at: profile?.full_name_confirmed_at || null }
      : entry)
  }

  // Get current user's entry
  const myEntry = usingGuestToken
    ? safeEntries.find(e => e.id === guestEntry.id && !e.is_removed) || null
    : safeEntries.find(e => e.user_id === user?.id && !e.is_removed) || null

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
      pool={{
        id: pool.id,
        tournament_id: pool.tournament_id,
        name: pool.name,
        passcode: isOwner ? pool.passcode : '',
        owner_id: isOwner ? pool.owner_id : '',
        pick_count: pool.pick_count,
        count_scores: pool.count_scores,
        ob_rule_enabled: pool.ob_rule_enabled,
        ob_penalty_strokes: pool.ob_penalty_strokes,
        is_locked: pool.is_locked,
        lock_at: pool.lock_at,
        is_completed: pool.is_completed,
        payment_status: pool.payment_status,
        amount_paid_cents: isOwner ? pool.amount_paid_cents : 0,
        game_format: pool.game_format,
        group_count: pool.group_count,
        picks_per_group: pool.picks_per_group,
        pick_groups_json: pool.pick_groups_json,
        groups_finalized_at: pool.groups_finalized_at,
        gpp_tournaments: tournament,
      }}
      tournament={tournament}
      entries={safeEntries}
      myEntry={myEntry}
      isOwner={isOwner}
      userId={user?.id || `guest:${guestEntry?.id || ''}`}
      guestEntryToken={usingGuestToken ? guestToken : ''}
      previousPlayerCandidates={previousPlayerCandidates}
      inviteSummary={inviteSummary}
    />
  )
}
