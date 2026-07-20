import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const emailHelper = readFileSync('src/lib/email.ts', 'utf8')
const transactionalEmails = readFileSync('src/lib/pool-transactional-emails.ts', 'utf8')
const finalResultsEmail = readFileSync('src/lib/final-results-email.ts', 'utf8')
const finalizer = readFileSync('src/lib/finalize-pool-results.ts', 'utf8')

assert.ok(
  emailHelper.includes('sendFinalResultsEmailViaForwardEmail'),
  'email helper should expose a Forward Email sender for final-results emails',
)
assert.ok(
  emailHelper.includes("process.env.FORWARD_EMAIL_SMTP_PASSWORD"),
  'Forward Email SMTP password should come from env, not code',
)
assert.ok(
  emailHelper.includes("'smtp.forwardemail.net'"),
  'Forward Email SMTP should default to smtp.forwardemail.net',
)
assert.ok(
  emailHelper.includes('AUTH PLAIN'),
  'Forward Email sender should authenticate with SMTP before sending',
)
assert.ok(
  emailHelper.includes('missing_forward_email_smtp_password'),
  'missing Forward Email credentials should queue final-results emails instead of falling back to Resend',
)

const singleFinalResultStart = transactionalEmails.indexOf('export async function sendFinalResultsEmail')
const digestFinalResultStart = transactionalEmails.indexOf('export async function sendFinalResultsDigestEmail')
assert.ok(singleFinalResultStart > -1 && digestFinalResultStart > singleFinalResultStart, 'final-results functions should exist')
const singleFinalResult = transactionalEmails.slice(singleFinalResultStart, digestFinalResultStart)
const digestFinalResult = transactionalEmails.slice(digestFinalResultStart)
assert.ok(
  singleFinalResult.includes('sendFinalResultsEmailViaForwardEmail'),
  'single final-results email should use Forward Email SMTP',
)
assert.ok(
  !singleFinalResult.includes('return sendEmail('),
  'single final-results email should not use Resend',
)
assert.ok(
  digestFinalResult.includes('sendFinalResultsEmailViaForwardEmail'),
  'digest final-results email should use Forward Email SMTP',
)
assert.ok(
  !digestFinalResult.includes('return sendEmail('),
  'digest final-results email should not use Resend',
)

assert.ok(
  finalResultsEmail.includes('FINAL_RESULTS_FORWARD_EMAIL_HARD_LIMIT = 250'),
  'final-results Forward Email hard limit should be 250 sends',
)
assert.ok(
  finalResultsEmail.includes('FINAL_RESULTS_FORWARD_EMAIL_WINDOW_MS = 24 * 60 * 60 * 1000'),
  'final-results cap should use a rolling 24-hour window',
)
assert.ok(
  finalResultsEmail.includes("provider: 'forward_email'"),
  'final-results event payload should record the Forward Email provider',
)
assert.ok(
  finalResultsEmail.includes('digestKey,'),
  'final-results event payload should record digest keys for per-message quota counting',
)
assert.ok(
  finalResultsEmail.includes('remainingForwardEmailSends <= 0'),
  'final-results sender should stop sending when quota is exhausted',
)
assert.ok(
  finalResultsEmail.includes('result.queued++'),
  'over-cap final-results sends should be counted as queued',
)
assert.ok(
  finalResultsEmail.includes('if ((sendResult as any)?.queued)'),
  'missing Forward Email credentials should leave reserved rows queued',
)
assert.ok(
  finalizer.includes('finalEmailsQueued'),
  'cron result should report queued final-results emails',
)

console.log('final-results Forward Email queue verified')
