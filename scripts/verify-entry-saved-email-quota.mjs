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
assert.ok(!savePicksBody.includes('/api/pools/entry-saved-email'), 'saving picks should not send saved-entry emails')
assert.ok(!saveGuestEmailBody.includes('/api/pools/entry-saved-email'), 'saving a guest notification email should not send saved-entry emails')
assert.ok(saveGuestEmailBody.includes("showToast(hadNotificationEmail ? 'Email updated.' : 'Email saved.'"), 'guest email save should confirm the save without claiming an email was sent')
assert.ok(!saveGuestEmailBody.includes('We sent your entry link'), 'guest email save should not claim an entry link email was sent')

assert.ok(entrySavedEmail.includes("reason: 'entry_saved_disabled'"), 'saved-entry email helper should be disabled')
assert.ok(!entrySavedEmail.includes('reserveEmailEvent'), 'disabled saved-entry helper should not create email-event rows')
assert.ok(!entrySavedEmail.includes("emailType: 'entry_saved'"), 'disabled saved-entry helper should not record entry_saved events')
assert.ok(!entrySavedEmail.includes('fetch('), 'disabled saved-entry helper should not call an email provider')
assert.ok(!entrySavedEmail.includes('createServiceClient'), 'disabled saved-entry helper should not touch the DB')

assert.ok(route.includes('sendEntrySavedEmail'), 'legacy saved-entry route should call the disabled helper')
assert.ok(!route.includes('createClient'), 'legacy saved-entry route should not require auth or touch Supabase')
assert.ok(route.includes('NextResponse.json({ ok: true, result })'), 'legacy saved-entry route should return a harmless no-op response')

console.log('entry-saved email disabled verified')
