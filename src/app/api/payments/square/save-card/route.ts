import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createSquareCard, createSquareCustomer } from '@/lib/payments/square'

export const runtime = 'nodejs'

function squareCardSaveKey(userId: string, paymentId: string) {
  const compactUserId = userId.replace(/-/g, '').slice(0, 16)
  const paymentHash = createHash('sha256').update(paymentId).digest('hex').slice(0, 12)
  return `gpp_card_${compactUserId}_${paymentHash}`
}

export async function POST(request: Request) {
  try {
    const supabase = (await createClient()) as any
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { poolId, paymentId } = await request.json()

    if (typeof poolId !== 'string' || typeof paymentId !== 'string' || !paymentId.trim()) {
      return NextResponse.json({ error: 'Missing payment details' }, { status: 400 })
    }

    const serviceSupabase = createServiceClient() as any

    const { data: pool, error: poolError } = await supabase
      .from('gpp_pools')
      .select('id, owner_id')
      .eq('id', poolId)
      .single()

    if (poolError || !pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
    }

    if (pool.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: poolPayment, error: paymentError } = await serviceSupabase
      .from('gpp_pool_payments')
      .select('id, square_payment_id')
      .eq('pool_id', poolId)
      .eq('square_payment_id', paymentId)
      .maybeSingle()

    if (paymentError || !poolPayment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    const { data: existingCards } = await serviceSupabase
      .from('gpp_saved_cards')
      .select('square_customer_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)

    let squareCustomerId = existingCards?.[0]?.square_customer_id || null

    if (!squareCustomerId) {
      const displayName = typeof user.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name
        : typeof user.user_metadata?.name === 'string'
          ? user.user_metadata.name
          : null
      const customer = await createSquareCustomer({
        idempotencyKey: `gpp_customer_${user.id.replace(/-/g, '').slice(0, 24)}`,
        userId: user.id,
        email: user.email || null,
        displayName,
      })
      squareCustomerId = customer?.id || null
    }

    if (!squareCustomerId) {
      return NextResponse.json({ error: 'Card could not be saved.' }, { status: 500 })
    }

    const card = await createSquareCard({
      idempotencyKey: squareCardSaveKey(user.id, paymentId),
      sourceId: paymentId,
      customerId: squareCustomerId,
    })

    if (!card?.id) {
      return NextResponse.json({ error: 'Card could not be saved.' }, { status: 500 })
    }

    await serviceSupabase
      .from('gpp_saved_cards')
      .update({ is_default: false, updated_at: new Date().toISOString() } as any)
      .eq('user_id', user.id)

    const { data: savedCard, error: saveError } = await serviceSupabase
      .from('gpp_saved_cards')
      .upsert({
        user_id: user.id,
        square_customer_id: squareCustomerId,
        square_card_id: card.id,
        brand: card.card_brand || card.brand || null,
        last_4: card.last_4 || null,
        exp_month: card.exp_month || null,
        exp_year: card.exp_year || null,
        cardholder_name: card.cardholder_name || null,
        is_default: true,
        updated_at: new Date().toISOString(),
      } as any, { onConflict: 'square_card_id' })
      .select('id, brand, last_4, exp_month, exp_year, is_default')
      .single()

    if (saveError || !savedCard) {
      return NextResponse.json({ error: 'Card was saved by Square, but app update failed.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, savedCard })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Card could not be saved.' }, { status: 500 })
  }
}
