type SendEmailInput = {
  to: string
  subject: string
  text: string
  html: string
}

export async function sendEmail({ to, subject, text, html }: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('email_skipped_missing_resend_key', { to, subject })
    return { skipped: true }
  }

  const from = process.env.ENTRY_EMAIL_FROM || 'Golf Pools Pro <hello@golfpoolspro.com>'
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, text, html, reply_to: 'hello@golfpoolspro.com' }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Email send failed: ${response.status} ${body.slice(0, 200)}`)
  }

  return response.json().catch(() => ({ ok: true }))
}
