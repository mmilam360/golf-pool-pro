import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type SupportRequestBody = {
  type?: unknown
  email?: unknown
  message?: unknown
  poolInfo?: unknown
  website?: unknown
}

type SupportDetails = {
  type: string
  email: string
  message: string
  poolInfo: string
  submittedAt: string
  referer: string
  forwardedFor: string
  userAgent: string
}

type DraftResult = {
  text: string
  source: 'llm' | 'fallback'
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

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
}

function fallbackDraft(details: SupportDetails) {
  const lower = `${details.message} ${details.poolInfo}`.toLowerCase()

  if (lower.includes('password') || lower.includes('login') || lower.includes('sign in')) {
    return 'Hi — thanks for reaching out. Try resetting your password from the login page first. If the reset link does not arrive or still does not work, send me the email on the account and I will check it from my side.'
  }

  if (lower.includes('payment') || lower.includes('square') || lower.includes('card') || lower.includes('charge')) {
    return 'Hi — thanks for reaching out. I am checking the payment record now. If you can send the pool name and the email used at checkout, I can match it up and make sure the pool is in the right state.'
  }

  if (lower.includes('pick') || lower.includes('entry') || lower.includes('player') || lower.includes('join')) {
    return 'Hi — thanks for reaching out. Send me the pool name or join link plus the email on the entry, and I will check what is happening with the picks/entry from my side.'
  }

  if (lower.includes('leaderboard') || lower.includes('score') || lower.includes('cut') || lower.includes('wd')) {
    return 'Hi — thanks for reaching out. I will check the tournament scoring feed and that pool’s leaderboard state. If you can send the pool name or link, I can look at the exact board.'
  }

  return 'Hi — thanks for reaching out. I am checking this now. If you can send the pool name or link and any screenshot that shows the issue, I can track it down faster.'
}

async function draftSupportReply(details: SupportDetails): Promise<DraftResult> {
  const fallback = fallbackDraft(details)
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return { text: fallback, source: 'fallback' }
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GPP_SUPPORT_LLM_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 420,
        messages: [
          {
            role: 'system',
            content: 'You draft concise customer-support replies for Golf Pools Pro, a golf pool app. Write in Michael\'s voice: casual, factual, helpful, no corporate fluff. Do not claim work is finished, do not promise refunds, and do not mention wagering/buy-ins/payouts. Give the most likely resolution or next step. The draft is for Michael to approve, not to send automatically.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              requestType: supportTypeLabel(details.type),
              customerEmail: details.email,
              poolInfo: details.poolInfo,
              page: details.referer,
              message: details.message,
            }),
          },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error('Support draft LLM request failed')
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const text = data.choices?.[0]?.message?.content?.trim()
    return { text: text || fallback, source: text ? 'llm' : 'fallback' }
  } catch (error) {
    console.error('support_request_draft_failed', error)
    return { text: fallback, source: 'fallback' }
  }
}

async function notifySupportEmail(details: SupportDetails, draft: DraftResult) {
  const apiKey = process.env.RESEND_API_KEY
  const supportTo = process.env.SUPPORT_EMAIL_TO || 'support@golfpoolspro.com'
  const supportFrom = process.env.SUPPORT_EMAIL_FROM || 'Golf Pools Pro <no-reply@golfpoolspro.com>'

  if (!apiKey) {
    throw new Error('Support email is not configured')
  }

  const label = supportTypeLabel(details.type)
  const subject = `Golf Pools Pro ${label} from ${details.email}`
  const text = [
    label,
    `From: ${details.email}`,
    details.poolInfo ? `Pool/tournament: ${details.poolInfo}` : null,
    `Submitted: ${details.submittedAt}`,
    `Page: ${details.referer}`,
    '',
    details.message,
    '',
    `Draft reply (${draft.source === 'llm' ? 'AI' : 'fallback'}, not sent):`,
    draft.text,
    '',
    `IP: ${details.forwardedFor}`,
    `UA: ${details.userAgent.slice(0, 220)}`,
  ].filter(Boolean).join('\n')

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: supportFrom,
      to: supportTo,
      reply_to: details.email,
      subject,
      text,
    }),
  })

  if (!response.ok) {
    throw new Error('Support email failed')
  }
}

async function notifySupportTelegram(details: SupportDetails, draft: DraftResult) {
  const token = process.env.SUPPORT_TELEGRAM_BOT_TOKEN
  const chatId = process.env.SUPPORT_TELEGRAM_CHAT_ID

  if (!token || !chatId) return

  const label = supportTypeLabel(details.type)
  const text = truncate([
    `New Golf Pools Pro ${label}`,
    `From: ${details.email}`,
    details.poolInfo ? `Pool/tournament: ${details.poolInfo}` : null,
    `Page: ${details.referer}`,
    `Submitted: ${details.submittedAt}`,
    '',
    'Customer message:',
    details.message,
    '',
    `Draft reply for approval (${draft.source === 'llm' ? 'AI' : 'fallback'}):`,
    draft.text,
  ].filter(Boolean).join('\n'), 3900)

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  })

  if (!response.ok) {
    throw new Error('Support Telegram notification failed')
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

  const details: SupportDetails = {
    type,
    email,
    message,
    poolInfo,
    forwardedFor: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
    referer: request.headers.get('referer') || 'unknown',
    submittedAt: new Date().toISOString(),
  }

  const draft = await draftSupportReply(details)

  try {
    await notifySupportEmail(details, draft)
  } catch (error) {
    console.error('support_request_email_failed', error)
    return NextResponse.json({ error: 'Support request could not be sent right now.' }, { status: 500 })
  }

  try {
    await notifySupportTelegram(details, draft)
  } catch (error) {
    console.error('support_request_telegram_failed', error)
  }

  return NextResponse.json({ ok: true })
}
