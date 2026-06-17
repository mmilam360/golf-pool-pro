type SendEmailInput = {
  to: string
  subject: string
  text: string
  html: string
}

export function outboundEmailHeaders() {
  return {
    from: process.env.ENTRY_EMAIL_FROM || 'Golf Pools Pro <no-reply@golfpoolspro.com>',
    reply_to: process.env.TRANSACTIONAL_EMAIL_REPLY_TO || 'no-reply@golfpoolspro.com',
  }
}

export async function sendEmail({ to, subject, text, html }: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('email_skipped_missing_resend_key', { to, subject })
    return { skipped: true }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...outboundEmailHeaders(), to, subject, text, html }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    console.error('email_send_failed', { status: response.status, body: body.slice(0, 200), to, subject })
    return { sent: false, status: response.status }
  }

  const data = await response.json().catch(() => ({ ok: true }))
  return { sent: true, data }
}
