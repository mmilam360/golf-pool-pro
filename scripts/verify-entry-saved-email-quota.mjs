import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const poolView = readFileSync('src/app/(app)/pool/[id]/PoolView.tsx', 'utf8')
const entrySavedEmail = readFileSync('src/lib/entry-saved-email.ts', 'utf8')
const route = readFileSync('src/app/api/pools/entry-saved-email/route.ts', 'utf8')

const savePicksStart = poolView.indexOf('async function savePicks()')
const saveEntryNameStart = poolView.indexOf('async function saveEntryName()')
const saveGuestEmailStart = poolView.indexOf('async function saveGuestEmailForUpdates()')
assert.ok(savePicksStart >= 0 && saveEntryNameStart > savePicksStart, 'PoolView should contain savePicks before saveEntryName')
assert.ok(saveGuestEmailStart > saveEntryNameStart, 'PoolView should contain saveGuestEmailForUpdates')

const savePicksBody = poolView.slice(savePicksStart, saveEntryNameStart)
const saveGuestEmailBody = poolView.slice(saveGuestEmailStart, poolView.indexOf('async function createGuestAccount()', saveGuestEmailStart))
assert.ok(!savePicksBody.includes('/api/pools/entry-saved-email'), 'saving picks should not send saved-entry email on account or repeat guest edits')
assert.ok(saveGuestEmailBody.includes('/api/pools/entry-saved-email'), 'guest post-save email capture should remain the saved-entry email trigger')
assert.ok(saveGuestEmailBody.includes('const hadNotificationEmail = Boolean(myEntry.notification_email?.trim())'), 'guest email flow should know whether this entry already had an email')
assert.ok(saveGuestEmailBody.includes('if (!hadNotificationEmail) {'), 'guest email flow should send entry-link email only the first time email is saved')
assert.ok(saveGuestEmailBody.includes("showToast(hadNotificationEmail ? 'Email updated.' : 'Email saved. We sent your entry link.'"), 'guest repeat email updates should not claim another email was sent')

assert.ok(entrySavedEmail.includes("if (entry.user_id) return { skipped: true, reason: 'account_entry' }"), 'saved-entry email helper should skip account-linked entries')
assert.ok(entrySavedEmail.includes("if (!token) return { skipped: true, reason: 'guest_token_required' }"), 'saved-entry email helper should require guest-token context')
assert.ok(entrySavedEmail.includes('const recipient = entry.notification_email ||'), 'saved-entry email helper should use only guest notification email')
assert.ok(!entrySavedEmail.includes('getUserById(entry.user_id)'), 'saved-entry email helper should not fetch account email for saved-entry messages')
assert.ok(entrySavedEmail.includes("emailType: 'entry_saved'"), 'saved-entry email helper should record email event type')
assert.ok(entrySavedEmail.includes('dedupeKey: `entry_saved:${poolId}:${entryId}`'), 'saved-entry email helper should dedupe to one saved-entry email per entry')
assert.ok(entrySavedEmail.includes("reason: 'duplicate_entry_saved_email'"), 'duplicate saved-entry email calls should be skipped')
assert.ok(route.includes('sendEntrySavedEmail({ entryId, poolId, token, userId: user?.id || null, origin })'), 'saved-entry email route should continue passing auth context into the guarded helper')

console.log('entry-saved email quota verified')
