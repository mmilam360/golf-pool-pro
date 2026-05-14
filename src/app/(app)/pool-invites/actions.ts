'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function formValues(formData: FormData, key: string) {
  return formData.getAll(key).map(value => String(value)).filter(Boolean)
}

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, user }
}

export async function sendPoolInvites(formData: FormData) {
  const poolId = String(formData.get('poolId') || '')
  const invitedUserIds = Array.from(new Set(formValues(formData, 'invitedUserId')))
  const { supabase, user } = await requireUser()

  if (!poolId || invitedUserIds.length === 0) {
    revalidatePath('/manage-pools')
    return
  }

  const { data: pool } = await supabase
    .from('gpp_pools')
    .select('id, owner_id, is_locked, is_completed, gpp_tournaments(status, start_date)')
    .eq('id', poolId)
    .single()

  const tournament = Array.isArray((pool as any)?.gpp_tournaments) ? (pool as any).gpp_tournaments[0] : (pool as any)?.gpp_tournaments
  const eventStarted = tournament?.start_date ? new Date(tournament.start_date).getTime() <= Date.now() : false
  const canInvite = pool?.owner_id === user.id && !pool?.is_locked && !pool?.is_completed && !eventStarted && tournament?.status !== 'live' && tournament?.status !== 'completed'

  if (!canInvite) {
    revalidatePath('/manage-pools')
    return
  }

  const rows = invitedUserIds
    .filter(invitedUserId => invitedUserId !== user.id)
    .map(invitedUserId => ({
      pool_id: poolId,
      invited_user_id: invitedUserId,
      invited_by_user_id: user.id,
      status: 'pending' as const,
    }))

  if (rows.length) {
    await supabase
      .from('gpp_pool_invites')
      .upsert(rows, { onConflict: 'pool_id,invited_user_id', ignoreDuplicates: true })
  }

  revalidatePath(`/pool/${poolId}`)
  revalidatePath('/dashboard')
}

export async function acceptPoolInvite(formData: FormData) {
  const inviteId = String(formData.get('inviteId') || '')
  const { supabase, user } = await requireUser()

  const { data: invite } = await supabase
    .from('gpp_pool_invites')
    .select('id, pool_id, status, gpp_pools(id, name, is_locked, is_completed, gpp_tournaments(status, start_date))')
    .eq('id', inviteId)
    .eq('invited_user_id', user.id)
    .single()

  const pool = Array.isArray((invite as any)?.gpp_pools) ? (invite as any).gpp_pools[0] : (invite as any)?.gpp_pools
  const tournament = Array.isArray(pool?.gpp_tournaments) ? pool.gpp_tournaments[0] : pool?.gpp_tournaments
  const picksClosed = pool?.is_locked || pool?.is_completed || tournament?.status === 'live' || tournament?.status === 'completed'

  if (!invite || invite.status !== 'pending' || !pool || picksClosed) {
    revalidatePath('/dashboard')
    return
  }

  const { data: existing } = await supabase
    .from('gpp_entries')
    .select('id')
    .eq('pool_id', invite.pool_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!existing) {
    const { data: profile } = await supabase
      .from('gpp_profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()

    await supabase
      .from('gpp_entries')
      .insert({
        pool_id: invite.pool_id,
        user_id: user.id,
        display_name: profile?.display_name || user.email?.split('@')[0] || 'Player',
        golfer_picks: [],
      })
  }

  await supabase
    .from('gpp_pool_invites')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', inviteId)
    .eq('invited_user_id', user.id)

  revalidatePath('/dashboard')
  redirect(`/pool/${invite.pool_id}`)
}

export async function declinePoolInvite(formData: FormData) {
  const inviteId = String(formData.get('inviteId') || '')
  const { supabase, user } = await requireUser()

  if (inviteId) {
    await supabase
      .from('gpp_pool_invites')
      .update({ status: 'declined', responded_at: new Date().toISOString() })
      .eq('id', inviteId)
      .eq('invited_user_id', user.id)
      .eq('status', 'pending')
  }

  revalidatePath('/dashboard')
}
