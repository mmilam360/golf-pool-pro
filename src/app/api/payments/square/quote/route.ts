import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getPoolPaymentQuote, getPoolPaymentStatus } from '@/lib/payments/pricing'
import { getSquareBrowserConfig } from '@/lib/payments/square'

export const runtime = 'nodejs'

async function getOwnedPoolQuote(poolId: string) {
  const supabase = (await createClient()) as any
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: pool, error: poolError } = await supabase
    .from('gpp_pools')
    .select('id, owner_id, name, payment_status, amount_paid_cents, paid_entry_limit')
    .eq('id', poolId)
    .single()

  if (poolError || !pool) {
    return { error: NextResponse.json({ error: 'Pool not found' }, { status: 404 }) }
  }

  if (pool.owner_id !== user.id) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  const { count, error: countError } = await supabase
    .from('gpp_entries')
    .select('id', { count: 'exact', head: true })
    .eq('pool_id', poolId)
    .eq('is_removed', false)

  if (countError) {
    return { error: NextResponse.json({ error: 'Could not count entries' }, { status: 500 }) }
  }

  const amountPaidCents = Number((pool as any).amount_paid_cents || 0)
  const quote = getPoolPaymentQuote(count || 0, amountPaidCents)

  const { data: savedCards } = await supabase
    .from('gpp_saved_cards')
    .select('id, brand, last_4, exp_month, exp_year, is_default, created_at')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  const storedPaymentStatus = (pool as any).payment_status || 'draft'
  const paymentStatus = getPoolPaymentStatus(storedPaymentStatus, count || 0, amountPaidCents)
  let claimedPromo: any = null

  try {
    const serviceSupabase = createServiceClient() as any
    const { data: redemption } = await serviceSupabase
      .from('gpp_promo_redemptions')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!redemption && quote.amountDueCents > 0) {
      const { data: firstOwnedPool } = await serviceSupabase
        .from('gpp_pools')
        .select('id')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      const { data: claim } = firstOwnedPool?.id === poolId ? await serviceSupabase
        .from('gpp_user_promo_claims')
        .select('gpp_promo_codes(code, description, free_pool, discount_cents, target_amount_cents, max_redemptions, times_redeemed, starts_at, expires_at, is_active)')
        .eq('user_id', user.id)
        .maybeSingle() : { data: null }

      const promo = Array.isArray(claim?.gpp_promo_codes) ? claim.gpp_promo_codes[0] : claim?.gpp_promo_codes
      const nowMs = Date.now()
      const startsAt = promo?.starts_at ? Date.parse(promo.starts_at) : null
      const expiresAt = promo?.expires_at ? Date.parse(promo.expires_at) : null
      const maxed = promo?.max_redemptions !== null && promo?.max_redemptions !== undefined && Number(promo.times_redeemed || 0) >= promo.max_redemptions

      if (promo?.is_active && !maxed && (!startsAt || nowMs >= startsAt) && (!expiresAt || nowMs <= expiresAt)) {
        claimedPromo = {
          code: promo.code,
          label: promo.target_amount_cents !== null && promo.target_amount_cents !== undefined
            ? `First pool capped at $${Math.round(Number(promo.target_amount_cents) / 100)}`
            : promo.free_pool
              ? 'First pool free'
              : 'First pool promo',
          discountCents: promo.discount_cents,
          targetAmountCents: promo.target_amount_cents,
          freePool: Boolean(promo.free_pool),
        }
      }
    }
  } catch {}

  if (paymentStatus !== storedPaymentStatus) {
    const updatePayload: Record<string, any> = { payment_status: paymentStatus }
    if (quote.amountDueCents <= 0) {
      updatePayload.paid_entry_limit = quote.entryLimit
      updatePayload.activated_at = new Date().toISOString()
    }

    await supabase
      .from('gpp_pools')
      .update(updatePayload as any)
      .eq('id', poolId)
  }

  return {
    pool,
    quote: {
      ...quote,
      paymentStatus,
      paidEntryLimit: Number((pool as any).paid_entry_limit || 5),
      square: getSquareBrowserConfig(),
      savedCards: savedCards || [],
      claimedPromo,
    },
  }
}

export async function POST(request: Request) {
  try {
    const { poolId } = await request.json()

    if (typeof poolId !== 'string') {
      return NextResponse.json({ error: 'Missing pool ID' }, { status: 400 })
    }

    const result = await getOwnedPoolQuote(poolId)
    if (result.error) return result.error

    return NextResponse.json(result.quote)
  } catch {
    return NextResponse.json({ error: 'Quote request failed' }, { status: 500 })
  }
}
