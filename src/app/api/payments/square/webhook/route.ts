import * as crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

function squareWebhookUrl(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  return siteUrl ? `${siteUrl}/api/payments/square/webhook` : request.url
}

function isValidSquareSignature(requestUrl: string, body: string, signature: string | null) {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY
  if (!key || !signature) return false

  const hmac = crypto
    .createHmac('sha256', key)
    .update(requestUrl + body)
    .digest('base64')

  const expected = Buffer.from(hmac)
  const received = Buffer.from(signature)
  if (expected.length !== received.length) return false

  return crypto.timingSafeEqual(expected, received)
}

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('x-square-hmacsha256-signature')

  if (!isValidSquareSignature(squareWebhookUrl(request), body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(body)
  const payment = event?.data?.object?.payment

  if (!payment?.id) {
    return NextResponse.json({ ok: true })
  }

  const supabase = createServiceClient() as any
  await supabase
    .from('gpp_pool_payments')
    .update({ status: payment.status || event.type || 'updated' })
    .eq('square_payment_id', payment.id)

  return NextResponse.json({ ok: true })
}
