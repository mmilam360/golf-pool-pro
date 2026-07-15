import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const recipients = readFileSync('src/lib/pool-email-recipients.ts', 'utf8')
const reminderEmails = readFileSync('src/lib/pool-transactional-emails.ts', 'utf8')
const cronRoute = readFileSync('src/app/api/cron/send-notifications/route.ts', 'utf8')

assert.ok(
  recipients.includes('const editPath = `/pool/${poolId}#make-picks`'),
  'account reminder edit links should redirect to the pick editor section'
)
assert.ok(
  recipients.includes('return `${origin}/pool/${poolId}?guest=${encodeURIComponent(token)}#make-picks`'),
  'guest reminder edit links should include the guest email token and open the pick editor section'
)
assert.ok(
  reminderEmails.includes('const subject = `Get your picks in for ${poolName}`'),
  'missing-picks reminder subject should include the exact pool name'
)
assert.ok(
  reminderEmails.includes('Picks are due before the first tee time: ${deadline}.') && reminderEmails.includes("ctaLabel: 'Make picks here'"),
  'missing-picks reminder should use the first-tee copy and Make picks here CTA'
)
assert.ok(
  reminderEmails.includes('const deadline = pickDeadlineLabel(params.pool, params.tournament)'),
  'missing-picks reminder should format the pool lock/first-tee deadline when available'
)
assert.ok(
  reminderEmails.includes('const editUrl = await entryEditUrl(params.supabase, params.origin, params.pool.id, params.entry, \'missing_picks_reminder\')'),
  'missing-picks reminder emails should use the shared entry edit URL helper'
)
assert.ok(
  reminderEmails.includes('Make picks here: ${editUrl}') && reminderEmails.includes('ctaHref: editUrl'),
  'missing-picks reminder should put the edit URL in both text and HTML CTA payloads'
)
assert.ok(
  cronRoute.includes('shouldSendMissingPicksEmailNow(pool)') && cronRoute.includes('sendMissingPicksReminderEmail'),
  'notification cron should send missing-picks reminder emails in the 24-hour window'
)
assert.ok(
  cronRoute.includes('dedupeKey: `missing_picks:${pool.id}:${entry.id}:${emailDateKey(deadline)}`'),
  'notification cron should dedupe automatic missing-picks emails per entry and lock date'
)

console.log('reminder edit links verified')
