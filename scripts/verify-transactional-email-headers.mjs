import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const emailHelper = readFileSync('src/lib/email.ts', 'utf8')

assert.ok(
  emailHelper.includes("Golf Pools Pro <no-reply@golfpoolspro.com>"),
  'transactional email default sender should be no-reply, not a personal/replyable inbox'
)
assert.ok(
  emailHelper.includes("TRANSACTIONAL_EMAIL_REPLY_TO || 'no-reply@golfpoolspro.com'"),
  'transactional email Reply-To should default to no-reply unless an explicitly verified support inbox is configured'
)
assert.ok(
  !emailHelper.includes("reply_to: 'hello@golfpoolspro.com'"),
  'transactional emails must not force replies to hello@golfpoolspro.com'
)

console.log('transactional email headers verified')
