import tls from 'node:tls'
import { randomUUID } from 'node:crypto'

type SendEmailInput = {
  to: string
  subject: string
  text: string
  html: string
  replyTo?: string
}

type SmtpResponse = {
  code: number
  message: string
}

export function outboundEmailHeaders(replyTo?: string) {
  return {
    from: process.env.ENTRY_EMAIL_FROM || 'Golf Pools Pro <no-reply@golfpoolspro.com>',
    reply_to: replyTo || process.env.TRANSACTIONAL_EMAIL_REPLY_TO || 'no-reply@golfpoolspro.com',
  }
}

function headerValue(value: string) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim()
}

function encodeHeader(value: string) {
  const clean = headerValue(value)
  if (/^[\x20-\x7E]*$/.test(clean)) return clean
  return `=?UTF-8?B?${Buffer.from(clean, 'utf8').toString('base64')}?=`
}

function emailAddress(value: string) {
  const clean = headerValue(value)
  const bracketMatch = clean.match(/<([^>]+)>/)
  const address = (bracketMatch?.[1] || clean).trim()
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)) throw new Error('Invalid email address')
  return address
}

function smtpSafeData(value: string) {
  return value
    .replace(/\r?\n/g, '\r\n')
    .replace(/^\./gm, '..')
}

function multipartEmail(input: SendEmailInput, from: string, replyTo: string) {
  const boundary = `gpp-${randomUUID()}`
  const messageId = `<${Date.now()}.${randomUUID()}@golfpoolspro.com>`
  const headers = [
    `From: ${headerValue(from)}`,
    `To: ${headerValue(input.to)}`,
    `Reply-To: ${headerValue(replyTo)}`,
    `Subject: ${encodeHeader(input.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ]

  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    input.text,
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    input.html,
    `--${boundary}--`,
    '',
  ]

  return { messageId, raw: `${headers.join('\r\n')}\r\n\r\n${body.join('\r\n')}` }
}

async function readSmtpResponse(socket: tls.TLSSocket) {
  return new Promise<SmtpResponse>((resolve, reject) => {
    let text = ''
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('SMTP response timeout'))
    }, 30000)

    function cleanup() {
      clearTimeout(timeout)
      socket.off('data', onData)
      socket.off('error', onError)
      socket.off('end', onEnd)
    }

    function onError(error: Error) {
      cleanup()
      reject(error)
    }

    function onEnd() {
      cleanup()
      reject(new Error('SMTP connection closed'))
    }

    function onData(chunk: Buffer) {
      text += chunk.toString('utf8')
      const lines = text.split(/\r?\n/).filter(Boolean)
      const last = lines[lines.length - 1]
      const match = last?.match(/^(\d{3}) /)
      if (!match) return
      cleanup()
      resolve({ code: Number(match[1]), message: text.trim() })
    }

    socket.on('data', onData)
    socket.on('error', onError)
    socket.on('end', onEnd)
  })
}

async function smtpCommand(socket: tls.TLSSocket, command: string, expected: number | number[]) {
  socket.write(`${command}\r\n`)
  const response = await readSmtpResponse(socket)
  const expectedCodes = Array.isArray(expected) ? expected : [expected]
  if (!expectedCodes.includes(response.code)) throw new Error(`SMTP ${response.code}: ${response.message.slice(0, 200)}`)
  return response
}

async function smtpData(socket: tls.TLSSocket, raw: string) {
  socket.write(`${smtpSafeData(raw)}\r\n.\r\n`)
  const response = await readSmtpResponse(socket)
  if (response.code !== 250) throw new Error(`SMTP ${response.code}: ${response.message.slice(0, 200)}`)
  return response
}

async function sendForwardEmailSmtp(input: SendEmailInput) {
  const smtpUser = process.env.FORWARD_EMAIL_SMTP_USER || 'no-reply@golfpoolspro.com'
  const smtpPassword = process.env.FORWARD_EMAIL_SMTP_PASSWORD
  const smtpHost = process.env.FORWARD_EMAIL_SMTP_HOST || 'smtp.forwardemail.net'
  const smtpPort = Number(process.env.FORWARD_EMAIL_SMTP_PORT || 465)
  if (!smtpPassword) {
    console.warn('final_results_email_queued_missing_forward_email_password', { to: input.to, subject: input.subject })
    return { skipped: true, reason: 'missing_forward_email_smtp_password', queued: true }
  }

  const headers = outboundEmailHeaders(input.replyTo)
  const from = process.env.FINAL_RESULTS_EMAIL_FROM || headers.from
  const replyTo = input.replyTo || process.env.TRANSACTIONAL_EMAIL_REPLY_TO || 'no-reply@golfpoolspro.com'
  const fromAddress = emailAddress(from)
  const recipientAddress = emailAddress(input.to)
  const { messageId, raw } = multipartEmail(input, from, replyTo)

  const socket = tls.connect({ host: smtpHost, port: smtpPort, servername: smtpHost })
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once('secureConnect', resolve)
      socket.once('error', reject)
      socket.setTimeout(30000, () => reject(new Error('SMTP connection timeout')))
    })
    await readSmtpResponse(socket)
    await smtpCommand(socket, `EHLO ${process.env.VERCEL_URL || 'golfpoolspro.com'}`, 250)
    await smtpCommand(socket, `AUTH PLAIN ${Buffer.from(`\0${smtpUser}\0${smtpPassword}`, 'utf8').toString('base64')}`, 235)
    await smtpCommand(socket, `MAIL FROM:<${fromAddress}>`, 250)
    await smtpCommand(socket, `RCPT TO:<${recipientAddress}>`, [250, 251])
    await smtpCommand(socket, 'DATA', 354)
    await smtpData(socket, raw)
    await smtpCommand(socket, 'QUIT', 221).catch(() => null)
    return { sent: true, data: { provider: 'forward_email', messageId } }
  } finally {
    socket.destroy()
  }
}

export async function sendEmail({ to, subject, text, html, replyTo }: SendEmailInput) {
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
    body: JSON.stringify({ ...outboundEmailHeaders(replyTo), to, subject, text, html }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    console.error('email_send_failed', { status: response.status, body: body.slice(0, 200), to, subject })
    return { sent: false, status: response.status }
  }

  const data = await response.json().catch(() => ({ ok: true }))
  return { sent: true, data }
}

export async function sendFinalResultsEmailViaForwardEmail(input: SendEmailInput) {
  return sendForwardEmailSmtp(input)
}
