import { createServiceClient } from '@/lib/supabase/service'
import { getPoolPaymentStatus, isPoolFeePastDue } from '@/lib/payments/pricing'
import { runCronRoute } from '@/lib/cron-run-log'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  return runCronRoute(request, async () => {
    const supabase = createServiceClient() as any
    const { data: tournaments, error: tournamentError } = await supabase
      .from('gpp_tournaments')
      .select('id, start_date, status')

    if (tournamentError) throw tournamentError

    const tournamentIds = (tournaments || [])
      .filter((tournament: any) => String(tournament.status || '').toLowerCase() !== 'completed')
      .filter((tournament: any) => isPoolFeePastDue(tournament.start_date))
      .map((tournament: any) => tournament.id)
    if (tournamentIds.length === 0) {
      return { archived: 0 }
    }

    const { data: pools, error } = await supabase
      .from('gpp_pools')
      .select('id, payment_status, amount_paid_cents')
      .in('tournament_id', tournamentIds)
      .in('payment_status', ['draft', 'active', 'payment_due'])
      .eq('is_completed', false)
      .is('results_finalized_at', null)

    if (error) throw error

    let activatedFree = 0
    let archived = 0

    for (const pool of pools || []) {
      const { count, error: countError } = await supabase
        .from('gpp_entries')
        .select('id', { count: 'exact', head: true })
        .eq('pool_id', pool.id)
        .eq('is_removed', false)

      if (countError) throw countError

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

    return { archived, activatedFree }
  })
}
