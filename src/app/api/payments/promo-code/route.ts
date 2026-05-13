import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getPoolPaymentQuote, getPromoDiscountCents } from '@/lib/payments/pricing'

export const runtime = 'nodejs'

function normalizePromoCode(value: unknown) {
  return typeof value === 'string' ? value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '') : ''
}

export async function POST(request: Request) {
  try {
    const { poolId, code } = await request.json()
    const promoCode = normalizePromoCode(code)

    if (typeof poolId !== 'string' || !promoCode) {
      return NextResponse.json({ error: 'Enter a promo code.' }, { status: 400 })
    }

    const supabase = (await createClient()) as any
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: pool, error: poolError } = await supabase
      .from('gpp_pools')
      .select('id, owner_id, amount_paid_cents')
      .eq('id', poolId)
      .single()

    if (poolError || !pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
    }

    if (pool.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { count, error: countError } = await supabase
      .from('gpp_entries')
      .select('id', { count: 'exact', head: true })
      .eq('pool_id', poolId)
      .eq('is_removed', false)

    if (countError) {
      return NextResponse.json({ error: 'Could not count entries' }, { status: 500 })
    }

    const activeEntryCount = count || 0
    const quote = getPoolPaymentQuote(activeEntryCount, Number(pool.amount_paid_cents || 0))
    const baseAmountDue = quote.amountDueCents || 0

    if (baseAmountDue <= 0) {
      return NextResponse.json({ error: 'This pool is already free.' }, { status: 400 })
    }

    const serviceSupabase = createServiceClient() as any
    const { data: existingRedemption } = await serviceSupabase
      .from('gpp_promo_redemptions')
      .select('id')
      .eq('pool_id', poolId)
      .maybeSingle()

    if (existingRedemption) {
      return NextResponse.json({ error: 'A promo code is already applied to this pool.' }, { status: 409 })
    }

    const { data: anyUserRedemption } = await serviceSupabase
      .from('gpp_promo_redemptions')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (anyUserRedemption) {
      return NextResponse.json({ error: 'You already used a promo code.' }, { status: 409 })
    }

    const { data: promo, error: promoError } = await serviceSupabase
      .from('gpp_promo_codes')
      .select('id, code, description, free_pool, discount_cents, max_redemptions, times_redeemed, starts_at, expires_at, is_active')
      .eq('code', promoCode)
      .maybeSingle()

    const now = Date.now()
    const startsAt = promo?.starts_at ? Date.parse(promo.starts_at) : null
    const expiresAt = promo?.expires_at ? Date.parse(promo.expires_at) : null

    if (promoError || !promo || !promo.is_active || (startsAt && now < startsAt) || (expiresAt && now > expiresAt)) {
      return NextResponse.json({ error: 'Promo code is not valid.' }, { status: 404 })
    }

    if (promo.times_redeemed >= 1 || (promo.max_redemptions !== null && promo.times_redeemed >= promo.max_redemptions)) {
      return NextResponse.json({ error: 'Promo code has already been used.' }, { status: 409 })
    }

    const discountCents = getPromoDiscountCents(baseAmountDue, promo)

    return NextResponse.json({
      code: promo.code,
      label: promo.description || `${promo.code} applied`,
      discountCents,
      amountDueCents: Math.max(0, baseAmountDue - discountCents),
    })
  } catch {
    return NextResponse.json({ error: 'Promo code check failed.' }, { status: 500 })
  }
}
