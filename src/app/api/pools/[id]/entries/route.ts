import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceSupabase = createServiceClient() as any
  const { data: pool, error: poolError } = await serviceSupabase
    .from('gpp_pools')
    .select('id, owner_id')
    .eq('id', id)
    .maybeSingle()
  if (poolError || !pool) return NextResponse.json({ error: 'Pool not found.' }, { status: 404 })
  if (pool.owner_id !== user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { data: entries, error: entriesError } = await serviceSupabase
    .from('gpp_entries')
    .select('id, pool_id, user_id, display_name, golfer_picks, total_score, counting_scores, rank, has_paid, payout_amount, is_removed, removed_reason, removed_at, full_name, full_name_confirmed_at, notification_email, created_at')
    .eq('pool_id', id)
    .order('created_at', { ascending: true })
  if (entriesError) return NextResponse.json({ error: entriesError.message }, { status: 500 })

  const accountUserIds = Array.from(new Set((entries || []).map((entry: any) => entry.user_id).filter(Boolean)))
  const { data: profiles } = accountUserIds.length
    ? await serviceSupabase
      .from('gpp_profiles')
      .select('id, email, full_name, full_name_confirmed_at')
      .in('id', accountUserIds)
    : { data: [] }
  const profileByUserId = new Map((profiles || []).map((profile: any) => [profile.id, profile]))
  const hydratedEntries = (entries || []).map((entry: any) => {
    if (!entry.user_id) return entry
    const profile = profileByUserId.get(entry.user_id) as any
    return {
      ...entry,
      account_email: profile?.email || '',
      account_full_name: profile?.full_name_confirmed_at ? profile?.full_name || '' : '',
      account_full_name_confirmed_at: profile?.full_name_confirmed_at || null,
    }
  })

  return NextResponse.json({ entries: hydratedEntries })
}


export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const action = typeof body.action === 'string' ? body.action : 'remove'
  const entryId = typeof body.entryId === 'string' ? body.entryId : ''
  const removedReason = typeof body.removedReason === 'string' ? body.removedReason.trim().slice(0, 200) : ''
  if (!entryId) return NextResponse.json({ error: 'Missing entry.' }, { status: 400 })

  const serviceSupabase = createServiceClient() as any
  const { data: pool, error: poolError } = await serviceSupabase
    .from('gpp_pools')
    .select('id, owner_id, is_locked, is_completed, payment_status, amount_paid_cents, gpp_tournaments(status)')
    .eq('id', id)
    .maybeSingle()
  if (poolError || !pool) return NextResponse.json({ error: 'Pool not found.' }, { status: 404 })

  const tournament = Array.isArray(pool.gpp_tournaments) ? pool.gpp_tournaments[0] : pool.gpp_tournaments
  const tournamentStatus = String(tournament?.status || '').toLowerCase()
  const entriesAreLocked = Boolean(pool.is_locked || pool.is_completed || tournamentStatus === 'live' || tournamentStatus === 'completed')
  const paymentAlreadyCollected = Number(pool.amount_paid_cents || 0) > 0

  if (action === 'leave') {
    if (entriesAreLocked) {
      return NextResponse.json({ error: 'Entries are locked for this pool.' }, { status: 409 })
    }
    if (pool.owner_id === user.id) {
      return NextResponse.json({ error: 'Pool runners cannot leave their own pool.' }, { status: 403 })
    }

    const { data: updatedEntry, error: updateError } = await serviceSupabase
      .from('gpp_entries')
      .update({ is_removed: true, removed_reason: 'Left pool', removed_at: new Date().toISOString() })
      .eq('id', entryId)
      .eq('pool_id', id)
      .eq('user_id', user.id)
      .eq('is_removed', false)
      .select('id')
      .maybeSingle()

    if (updateError) return NextResponse.json({ error: updateError.message || 'Could not leave pool.' }, { status: 500 })
    if (!updatedEntry?.id) return NextResponse.json({ error: 'Entry not found.' }, { status: 404 })

    return NextResponse.json({ ok: true })
  }

  if (pool.owner_id !== user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  if (pool.is_completed || tournamentStatus === 'completed') {
    return NextResponse.json({ error: 'This pool is completed.' }, { status: 409 })
  }

  if (paymentAlreadyCollected) {
    return NextResponse.json({ error: 'Pool payment is already recorded. Contact support to change entries.' }, { status: 409 })
  }

  const ownerRemovalReason = removedReason || 'Removed by pool runner'

  const { data: updatedEntry, error: updateError } = await serviceSupabase
    .from('gpp_entries')
    .update({ is_removed: true, removed_reason: ownerRemovalReason, removed_at: new Date().toISOString() })
    .eq('id', entryId)
    .eq('pool_id', id)
    .eq('is_removed', false)
    .select('id')
    .maybeSingle()

  if (updateError) return NextResponse.json({ error: updateError.message || 'Could not remove entry.' }, { status: 500 })
  if (!updatedEntry?.id) return NextResponse.json({ error: 'Entry not found.' }, { status: 404 })

  return NextResponse.json({ ok: true, removedReason: ownerRemovalReason })
}
