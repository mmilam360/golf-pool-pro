import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

type PromoRow = {
  id: string
  code: string
  description: string | null
  free_pool: boolean | null
  discount_cents: number | null
  target_amount_cents: number | null
  max_redemptions: number | null
  times_redeemed: number | null
  starts_at: string | null
  expires_at: string | null
  is_active: boolean | null
}

function normalizePromoCode(value: unknown) {
  return typeof value === 'string' ? value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '') : ''
}

function isPromoUsable(promo: PromoRow | null) {
  if (!promo?.is_active) return false
  const nowMs = Date.now()
  const startsAt = promo.starts_at ? Date.parse(promo.starts_at) : null
  const expiresAt = promo.expires_at ? Date.parse(promo.expires_at) : null
  if (startsAt && nowMs < startsAt) return false
  if (expiresAt && nowMs > expiresAt) return false
  if (promo.max_redemptions !== null && promo.max_redemptions !== undefined && Number(promo.times_redeemed || 0) >= promo.max_redemptions) return false
  return true
}

function labelForPromo(promo: PromoRow) {
  if (promo.target_amount_cents !== null && promo.target_amount_cents !== undefined) {
    return `Your first pool is capped at $${Math.round(Number(promo.target_amount_cents) / 100)}`
  }
  if (promo.free_pool) return 'Your first pool is free'
  if (promo.discount_cents) return `$${Math.round(Number(promo.discount_cents) / 100)} off your first pool`
  return 'Promo saved for your first pool'
}

export async function GET() {
  try {
    const supabase = (await createClient()) as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ claimedPromo: null }, { status: 401 })

    const serviceSupabase = createServiceClient() as any
    const { data: redemption } = await serviceSupabase
      .from('gpp_promo_redemptions')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (redemption) return NextResponse.json({ claimedPromo: null, used: true })

    const { data: claim } = await serviceSupabase
      .from('gpp_user_promo_claims')
      .select('promo_code_id, gpp_promo_codes(id, code, description, free_pool, discount_cents, target_amount_cents, max_redemptions, times_redeemed, starts_at, expires_at, is_active)')
      .eq('user_id', user.id)
      .maybeSingle()

    const rawPromo = Array.isArray(claim?.gpp_promo_codes) ? claim.gpp_promo_codes[0] : claim?.gpp_promo_codes
    const promo = rawPromo as PromoRow | null
    if (!isPromoUsable(promo)) return NextResponse.json({ claimedPromo: null })

    return NextResponse.json({
      claimedPromo: {
        code: promo!.code,
        label: labelForPromo(promo!),
        targetAmountCents: promo!.target_amount_cents,
        discountCents: promo!.discount_cents,
        freePool: Boolean(promo!.free_pool),
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Promo lookup failed' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = (await createClient()) as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { promoCode: rawPromoCode, source } = await request.json()
    const promoCode = normalizePromoCode(rawPromoCode)
    if (!promoCode) return NextResponse.json({ error: 'Missing promo code' }, { status: 400 })

    const serviceSupabase = createServiceClient() as any
    const { data: redemption } = await serviceSupabase
      .from('gpp_promo_redemptions')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (redemption) return NextResponse.json({ claimedPromo: null, used: true })

    const { data: promo, error: promoError } = await serviceSupabase
      .from('gpp_promo_codes')
      .select('id, code, description, free_pool, discount_cents, target_amount_cents, max_redemptions, times_redeemed, starts_at, expires_at, is_active')
      .eq('code', promoCode)
      .maybeSingle()

    if (promoError || !isPromoUsable(promo as PromoRow | null)) {
      return NextResponse.json({ error: 'Promo code is not valid.' }, { status: 404 })
    }

    const { error: claimError } = await serviceSupabase
      .from('gpp_user_promo_claims')
      .upsert({
        user_id: user.id,
        promo_code_id: promo.id,
        source: typeof source === 'string' ? source.slice(0, 80) : 'signup-link',
      } as any, { onConflict: 'user_id' })

    if (claimError) return NextResponse.json({ error: 'Promo could not be saved.' }, { status: 500 })

    return NextResponse.json({
      claimedPromo: {
        code: promo.code,
        label: labelForPromo(promo as PromoRow),
        targetAmountCents: promo.target_amount_cents,
        discountCents: promo.discount_cents,
        freePool: Boolean(promo.free_pool),
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Promo claim failed' }, { status: 500 })
  }
}
