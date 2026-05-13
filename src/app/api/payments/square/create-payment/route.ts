import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createSquarePayment } from '@/lib/payments/square'
import { getPoolPaymentQuote, getPromoDiscountCents } from '@/lib/payments/pricing'

export const runtime = 'nodejs'

function normalizePromoCode(value: unknown) {
  return typeof value === 'string' ? value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '') : ''
}

export async function POST(request: Request) {
  try {
    const supabase = (await createClient()) as any
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { poolId, sourceId, promoCode: rawPromoCode } = await request.json()
    const promoCode = normalizePromoCode(rawPromoCode)

    if (typeof poolId !== 'string' || typeof sourceId !== 'string') {
      return NextResponse.json({ error: 'Missing payment details' }, { status: 400 })
    }

    const { data: pool, error: poolError } = await supabase
      .from('gpp_pools')
      .select('id, owner_id, tournament_id, name, is_locked, payment_status, amount_paid_cents, paid_entry_limit, activated_at, square_payment_ids, square_order_ids')
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
    const amountPaidCents = Number((pool as any).amount_paid_cents || 0)
    const quote = getPoolPaymentQuote(activeEntryCount, amountPaidCents)
    let discountCents = 0
    let promo: any = null
    const serviceSupabase = createServiceClient() as any

    const { data: tournament, error: tournamentError } = await supabase
      .from('gpp_tournaments')
      .select('status')
      .eq('id', (pool as any).tournament_id)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    const paymentCollectionOpen = Boolean((pool as any).is_locked) || tournament.status === 'live' || tournament.status === 'completed'

    if (quote.requiresCustomQuote || quote.amountDueCents === null || quote.entryLimit === null) {
      return NextResponse.json({ error: 'This pool needs a custom quote' }, { status: 400 })
    }

    if (promoCode && quote.amountDueCents > 0) {
      const { data: existingRedemption } = await serviceSupabase
        .from('gpp_promo_redemptions')
        .select('id')
        .eq('pool_id', poolId)
        .maybeSingle()

      if (existingRedemption) {
        return NextResponse.json({ error: 'A promo code is already applied to this pool.' }, { status: 409 })
      }

      const { data: promoRow, error: promoError } = await serviceSupabase
        .from('gpp_promo_codes')
        .select('id, code, description, free_pool, discount_cents, max_redemptions, times_redeemed, starts_at, expires_at, is_active')
        .eq('code', promoCode)
        .maybeSingle()

      const nowMs = Date.now()
      const startsAt = promoRow?.starts_at ? Date.parse(promoRow.starts_at) : null
      const expiresAt = promoRow?.expires_at ? Date.parse(promoRow.expires_at) : null

      if (promoError || !promoRow || !promoRow.is_active || (startsAt && nowMs < startsAt) || (expiresAt && nowMs > expiresAt)) {
        return NextResponse.json({ error: 'Promo code is not valid.' }, { status: 404 })
      }

      if (promoRow.max_redemptions !== null && promoRow.times_redeemed >= promoRow.max_redemptions) {
        return NextResponse.json({ error: 'Promo code has already been used.' }, { status: 409 })
      }

      const { data: userRedemption } = await serviceSupabase
        .from('gpp_promo_redemptions')
        .select('id')
        .eq('promo_code_id', promoRow.id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (userRedemption) {
        return NextResponse.json({ error: 'You already used this promo code.' }, { status: 409 })
      }

      promo = promoRow
      discountCents = getPromoDiscountCents(quote.amountDueCents, promoRow)
    }

    const finalAmountDueCents = Math.max(0, quote.amountDueCents - discountCents)

    if (finalAmountDueCents <= 0) {
      if (promo && discountCents > 0) {
        const { error: redemptionError } = await serviceSupabase.from('gpp_promo_redemptions').insert({
          promo_code_id: promo.id,
          pool_id: poolId,
          user_id: user.id,
          discount_cents: discountCents,
          entry_count_at_redemption: activeEntryCount,
        } as any)

        if (redemptionError) {
          return NextResponse.json({ error: 'Promo code could not be applied.' }, { status: 500 })
        }

        await serviceSupabase
          .from('gpp_promo_codes')
          .update({ times_redeemed: Number(promo.times_redeemed || 0) + 1 } as any)
          .eq('id', promo.id)
      }

      await serviceSupabase
        .from('gpp_pools')
        .update({ payment_status: 'active', paid_entry_limit: quote.entryLimit, activated_at: new Date().toISOString() } as any)
        .eq('id', poolId)
      return NextResponse.json({ success: true, amountDueCents: 0, discountCents, promoCode: promo?.code || null, entryLimit: quote.entryLimit })
    }

    if (!paymentCollectionOpen) {
      return NextResponse.json({ error: 'Payment opens after picks lock.' }, { status: 409 })
    }

    const compactPoolId = poolId.replace(/-/g, '')
    const idempotencyKey = `gpp_${compactPoolId}_${activeEntryCount}_${finalAmountDueCents}`
    const payment = await createSquarePayment({
      sourceId,
      idempotencyKey,
      amountCents: finalAmountDueCents,
      poolId,
      poolName: pool.name,
    })

    const nextAmountPaid = amountPaidCents + finalAmountDueCents
    const now = new Date().toISOString()
    const existingPaymentIds = Array.isArray((pool as any).square_payment_ids) ? (pool as any).square_payment_ids : []
    const existingOrderIds = Array.isArray((pool as any).square_order_ids) ? (pool as any).square_order_ids : []

    const { error: insertPaymentError } = await serviceSupabase.from('gpp_pool_payments').upsert({
      pool_id: poolId,
      provider: 'square',
      square_payment_id: payment?.id || null,
      square_order_id: payment?.order_id || null,
      amount_cents: finalAmountDueCents,
      entry_count_at_payment: activeEntryCount,
      entry_limit: quote.entryLimit,
      status: payment?.status || 'COMPLETED',
    } as any, { onConflict: 'square_payment_id' })

    if (insertPaymentError) {
      return NextResponse.json({ error: 'Payment recorded by Square, but app update failed' }, { status: 500 })
    }

    const { error: updateError } = await serviceSupabase
      .from('gpp_pools')
      .update({
        payment_status: 'active',
        paid_entry_limit: quote.entryLimit,
        amount_paid_cents: nextAmountPaid,
        activated_at: (pool as any).activated_at || now,
        last_payment_at: now,
        square_payment_ids: payment?.id ? [...existingPaymentIds, payment.id] : existingPaymentIds,
        square_order_ids: payment?.order_id ? [...existingOrderIds, payment.order_id] : existingOrderIds,
      } as any)
      .eq('id', poolId)

    if (updateError) {
      return NextResponse.json({ error: 'Payment recorded by Square, but pool update failed' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      paymentId: payment?.id,
      amountPaidCents: nextAmountPaid,
      amountDueCents: 0,
      discountCents,
      promoCode: promo?.code || null,
      entryLimit: quote.entryLimit,
      paymentStatus: 'active',
    })
  } catch (error: any) {
    const message = error?.message === 'Square is not configured'
      ? 'Square is not configured'
      : error?.message || 'Payment failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
