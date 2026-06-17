import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const recipients = readFileSync('src/lib/pool-email-recipients.ts', 'utf8')
const reminderEmails = readFileSync('src/lib/pool-transactional-emails.ts', 'utf8')

assert.ok(
  recipients.includes('const editPath = `/pool/${poolId}#make-picks`'),
  'account reminder edit links should redirect to the pick editor section'
)
assert.ok(
  recipients.includes('return `${origin}/pool/${poolId}?guest=${encodeURIComponent(token)}#make-picks`'),
  'guest reminder edit links should include the guest email token and open the pick editor section'
)
assert.ok(
  reminderEmails.includes('const editUrl = await entryEditUrl(params.supabase, params.origin, params.pool.id, params.entry, \'missing_picks_reminder\')'),
  'missing-picks reminder emails should use the shared entry edit URL helper'
)
assert.ok(
  reminderEmails.includes('Finish picks: ${editUrl}') && reminderEmails.includes('ctaHref: editUrl'),
  'missing-picks reminder should put the edit URL in both text and HTML CTA payloads'
)

console.log('reminder edit links verified')
