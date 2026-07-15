import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const route = readFileSync('src/app/api/support/request/route.ts', 'utf8')
const emailHelper = readFileSync('src/lib/email.ts', 'utf8')

assert.ok(route.includes("import { sendEmail } from '@/lib/email'"), 'support requests should use the shared Resend-backed email helper')
assert.ok(route.includes("process.env.SUPPORT_EMAIL_TO || 'hello@golfpoolspro.com'"), 'support requests should default to the working hello inbox')
assert.ok(route.includes('replyTo: email'), 'support request notifications should reply to the customer email')
assert.ok(!route.includes('SUPPORT_TELEGRAM_BOT_TOKEN'), 'support route should no longer depend on Telegram bot env')
assert.ok(!route.includes('SUPPORT_TELEGRAM_CHAT_ID'), 'support route should no longer depend on Telegram chat env')
assert.ok(!route.includes('nodemailer'), 'support route should not depend on a separate SMTP provider')

assert.ok(emailHelper.includes('replyTo?: string'), 'shared email helper should allow explicit internal Reply-To overrides')
assert.ok(
  emailHelper.includes("reply_to: replyTo || process.env.TRANSACTIONAL_EMAIL_REPLY_TO || 'no-reply@golfpoolspro.com'"),
  'shared email helper should keep no-reply as the default Reply-To'
)

console.log('support email route verified')
