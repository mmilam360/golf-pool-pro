import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type SupportRequestBody = {
  type?: unknown
  email?: unknown
  message?: unknown
  poolInfo?: unknown
  website?: unknown
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return ''
  return value.replace(/\r/g, '').trim().slice(0, maxLength)
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 160
}

function supportTypeLabel(type: string) {
  return type === 'feature' ? 'Feature request' : 'Support request'
}

async function notifyTelegram(text: string) {
  const token = process.env.SUPPORT_TELEGRAM_BOT_TOKEN
  const chatId = process.env.SUPPORT_TELEGRAM_CHAT_ID

  if (!token || !chatId) {
    throw new Error('Support notifications are not configured')
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  })

  if (!response.ok) {
    throw new Error('Support notification failed')
  }
}

export async function POST(request: Request) {
  let body: SupportRequestBody = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const honeypot = cleanText(body.website, 200)
  if (honeypot) {
    return NextResponse.json({ ok: true })
  }

  const type = body.type === 'feature' ? 'feature' : 'support'
  const email = cleanText(body.email, 160)
  const message = cleanText(body.message, 3000)
  const poolInfo = cleanText(body.poolInfo, 240)

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Enter a valid email.' }, { status: 400 })
  }

  if (message.length < 8) {
    return NextResponse.json({ error: 'Add a little more detail.' }, { status: 400 })
  }

  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'
  const referer = request.headers.get('referer') || 'unknown'
  const submittedAt = new Date().toISOString()

  const telegramMessage = [
    `Golf Pools Pro ${supportTypeLabel(type)}`,
    `Email: ${email}`,
    poolInfo ? `Pool/tournament: ${poolInfo}` : null,
    `Submitted: ${submittedAt}`,
    `Page: ${referer}`,
    '',
    message,
    '',
    `IP: ${forwardedFor}`,
    `UA: ${userAgent.slice(0, 220)}`,
  ].filter(Boolean).join('\n')

  try {
    await notifyTelegram(telegramMessage.slice(0, 3900))
  } catch (error) {
    console.error('support_request_notify_failed', error)
    return NextResponse.json({ error: 'Support request could not be sent right now.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
