import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getPoolPaymentStatus, isPoolFeePastDue } from '@/lib/payments/pricing'
import { requireCronAuth } from '@/lib/cron-auth'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const authError = requireCronAuth(request)
  if (authError) return authError

  const supabase = createServiceClient() as any
  const { data: tournaments, error: tournamentError } = await supabase
    .from('gpp_tournaments')
    .select('id, start_date')

  if (tournamentError) {
    return NextResponse.json({ error: tournamentError.message }, { status: 500 })
  }

  const tournamentIds = (tournaments || [])
    .filter((tournament: any) => isPoolFeePastDue(tournament.start_date))
    .map((tournament: any) => tournament.id)
  if (tournamentIds.length === 0) {
    return NextResponse.json({ ok: true, archived: 0 })
  }

  const { data: pools, error } = await supabase
    .from('gpp_pools')
    .select('id, payment_status, amount_paid_cents')
    .in('tournament_id', tournamentIds)
    .in('payment_status', ['draft', 'active', 'payment_due'])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let activatedFree = 0
  let archived = 0

  for (const pool of pools || []) {
    const { count, error: countError } = await supabase
      .from('gpp_entries')
      .select('id', { count: 'exact', head: true })
      .eq('pool_id', pool.id)
      .eq('is_removed', false)

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 })
    }

    const paymentStatus = getPoolPaymentStatus(pool.payment_status, count || 0, Number(pool.amount_paid_cents || 0))

    if (paymentStatus === 'active') {
      await supabase
        .from('gpp_pools')
        .update({ payment_status: 'active', paid_entry_limit: count || 0, activated_at: new Date().toISOString() } as any)
        .eq('id', pool.id)
      activatedFree += 1
      continue
    }

    if (paymentStatus === 'draft' || paymentStatus === 'payment_due') {
      await supabase
        .from('gpp_pools')
        .update({ payment_status: 'archived_unpaid' } as any)
        .eq('id', pool.id)
      archived += 1
    }
  }

  return NextResponse.json({ ok: true, archived, activatedFree })
}
