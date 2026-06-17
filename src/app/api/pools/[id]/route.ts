import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

type OwnerPool = {
  id: string
  owner_id: string
  name: string
  is_locked: boolean
  is_completed: boolean
  game_format: string | null
  groups_finalized_at: string | null
  gpp_tournaments?: { status?: string | null } | { status?: string | null }[] | null
}

async function loadOwnerPool(poolId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const serviceSupabase = createServiceClient() as any
  const { data: pool, error } = await serviceSupabase
    .from('gpp_pools')
    .select('id, owner_id, name, is_locked, is_completed, game_format, groups_finalized_at, gpp_tournaments(status)')
    .eq('id', poolId)
    .maybeSingle()

  if (error || !pool) return { response: NextResponse.json({ error: 'Pool not found.' }, { status: 404 }) }
  if (pool.owner_id !== user.id) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) }

  return { user, pool: pool as OwnerPool, serviceSupabase }
}

function tournamentStatus(pool: OwnerPool) {
  const tournament = Array.isArray(pool.gpp_tournaments) ? pool.gpp_tournaments[0] : pool.gpp_tournaments
  return String(tournament?.status || '').toLowerCase()
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params
  const context = await loadOwnerPool(id)
  if (context.response) return context.response

  const { pool, serviceSupabase } = context
  const body = await request.json().catch(() => ({}))
  const action = typeof body.action === 'string' ? body.action : ''

  if (action === 'rename') {
    const nextName = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : ''
    if (!nextName) return NextResponse.json({ error: 'Pool name cannot be blank.' }, { status: 400 })

    const { data: updatedPool, error } = await serviceSupabase
      .from('gpp_pools')
      .update({ name: nextName })
      .eq('id', pool.id)
      .eq('owner_id', context.user!.id)
      .select('id, name')
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message || 'Could not update pool name.' }, { status: 500 })
    if (!updatedPool?.id) return NextResponse.json({ error: 'Pool not found.' }, { status: 404 })
    return NextResponse.json({ ok: true, pool: updatedPool })
  }

  if (action === 'lock') {
    const status = tournamentStatus(pool)
    if (pool.is_locked) return NextResponse.json({ error: 'Pool is already locked.' }, { status: 409 })
    if (pool.is_completed || status === 'live' || status === 'completed') {
      return NextResponse.json({ error: 'Entries and picks are already closed.' }, { status: 409 })
    }
    if (['ranked_groups', 'random_groups'].includes(String(pool.game_format || '')) && !pool.groups_finalized_at) {
      return NextResponse.json({ error: 'Lock groups before locking picks.' }, { status: 409 })
    }

    const { data: updatedPool, error } = await serviceSupabase
      .from('gpp_pools')
      .update({ is_locked: true })
      .eq('id', pool.id)
      .eq('owner_id', context.user!.id)
      .eq('is_locked', false)
      .eq('is_completed', false)
      .select('id')
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message || 'Could not lock pool.' }, { status: 500 })
    if (!updatedPool?.id) return NextResponse.json({ error: 'Pool could not be locked.' }, { status: 409 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown pool action.' }, { status: 400 })
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { id } = await params
  const context = await loadOwnerPool(id)
  if (context.response) return context.response

  const body = await request.json().catch(() => ({}))
  if (body.confirm !== 'DELETE') return NextResponse.json({ error: 'Type DELETE to confirm.' }, { status: 400 })

  const { pool, serviceSupabase } = context
  const { data: entries, error: entriesError } = await serviceSupabase
    .from('gpp_entries')
    .select('id')
    .eq('pool_id', pool.id)
  if (entriesError) return NextResponse.json({ error: entriesError.message || 'Could not load pool entries.' }, { status: 500 })

  const entryIds = (entries || []).map((entry: any) => entry.id).filter(Boolean)
  if (entryIds.length > 0) {
    for (const table of ['gpp_guest_entry_tokens']) {
      const { error } = await serviceSupabase.from(table).delete().in('entry_id', entryIds)
      if (error) return NextResponse.json({ error: error.message || 'Could not delete pool.' }, { status: 500 })
    }
    const { error: dismissalsError } = await serviceSupabase
      .from('gpp_final_result_dismissals')
      .delete()
      .in('entry_id', entryIds)
    if (dismissalsError) return NextResponse.json({ error: dismissalsError.message || 'Could not delete pool.' }, { status: 500 })

    const { error: emailEventsByEntryError } = await serviceSupabase
      .from('gpp_email_events')
      .delete()
      .in('entry_id', entryIds)
    if (emailEventsByEntryError) return NextResponse.json({ error: emailEventsByEntryError.message || 'Could not delete pool.' }, { status: 500 })
  }

  for (const table of [
    'gpp_final_result_dismissals',
    'gpp_email_events',
    'gpp_notification_events',
    'gpp_email_log',
    'gpp_pool_invites',
    'gpp_pool_payments',
    'gpp_promo_redemptions',
    'gpp_entries',
  ]) {
    const { error } = await serviceSupabase.from(table).delete().eq('pool_id', pool.id)
    if (error) return NextResponse.json({ error: error.message || 'Could not delete pool.' }, { status: 500 })
  }

  const { data: deletedPool, error: poolDeleteError } = await serviceSupabase
    .from('gpp_pools')
    .delete()
    .eq('id', pool.id)
    .eq('owner_id', context.user!.id)
    .select('id')
    .maybeSingle()

  if (poolDeleteError) return NextResponse.json({ error: poolDeleteError.message || 'Could not delete pool.' }, { status: 500 })
  if (!deletedPool?.id) return NextResponse.json({ error: 'Pool not found.' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
