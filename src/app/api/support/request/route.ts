import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'

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

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

async function notifySupportEmail({
  type,
  email,
  message,
  poolInfo,
  submittedAt,
  referer,
  forwardedFor,
  userAgent,
}: {
  type: string
  email: string
  message: string
  poolInfo: string
  submittedAt: string
  referer: string
  forwardedFor: string
  userAgent: string
}) {
  const supportTo = process.env.SUPPORT_EMAIL_TO || 'hello@golfpoolspro.com'
  const label = supportTypeLabel(type)
  const subject = `Golf Pools Pro ${label} from ${email}`
  const text = [
    label,
    `From: ${email}`,
    poolInfo ? `Pool/tournament: ${poolInfo}` : null,
    `Submitted: ${submittedAt}`,
    `Page: ${referer}`,
    '',
    message,
    '',
    `IP: ${forwardedFor}`,
    `UA: ${userAgent.slice(0, 220)}`,
  ].filter(Boolean).join('\n')

  const html = `
    <div style="margin:0;padding:0;background:#f6f0e3;font-family:Arial,Helvetica,sans-serif;color:#1f2a24;line-height:1.5;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f6f0e3;margin:0;padding:0;">
        <tr>
          <td align="center" style="padding:28px 14px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;max-width:640px;background:#fbf7ed;border:2px solid #123c2f;">
              <tr>
                <td style="background:#123c2f;border-bottom:2px solid #b58a3a;padding:22px 24px;color:#ffffff;">
                  <div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#f3df9c;font-weight:800;">Golf Pools Pro</div>
                  <h1 style="margin:6px 0 0;font-family:Arial Black,Impact,Arial,Helvetica,sans-serif;font-size:26px;line-height:1.05;letter-spacing:-0.04em;text-transform:uppercase;color:#ffffff;">${escapeHtml(label)}</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:22px 24px;background:#fffdf8;">
                  <p style="margin:0 0 12px;font-size:16px;"><strong>From:</strong> <a href="mailto:${escapeHtml(email)}" style="color:#123c2f;font-weight:800;">${escapeHtml(email)}</a></p>
                  ${poolInfo ? `<p style="margin:0 0 12px;"><strong>Pool/tournament:</strong> ${escapeHtml(poolInfo)}</p>` : ''}
                  <p style="margin:0 0 12px;"><strong>Submitted:</strong> ${escapeHtml(submittedAt)}</p>
                  <p style="margin:0 0 18px;"><strong>Page:</strong> ${escapeHtml(referer)}</p>
                  <div style="border:1px solid #d8cab0;background:#fbf7ed;padding:14px 16px;white-space:pre-wrap;">${escapeHtml(message)}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 24px 22px;border-top:1px solid #d8cab0;background:#fbf7ed;color:#657168;font-size:12px;">
                  IP: ${escapeHtml(forwardedFor)}<br />UA: ${escapeHtml(userAgent.slice(0, 220))}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `

  return sendEmail({
    to: supportTo,
    subject,
    text,
    html,
    replyTo: email,
  })
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

  try {
    const result = await notifySupportEmail({
      type,
      email,
      message,
      poolInfo,
      submittedAt,
      referer,
      forwardedFor,
      userAgent,
    })
    if ((result as any)?.sent === false || (result as any)?.skipped) {
      return NextResponse.json({ error: 'Support request could not be sent right now.' }, { status: 500 })
    }
  } catch (error) {
    console.error('support_request_email_failed', error)
    return NextResponse.json({ error: 'Support request could not be sent right now.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
