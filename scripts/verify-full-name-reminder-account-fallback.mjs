import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { entryNeedsConfirmedFullName, hasConfirmedFullName } from '../src/lib/full-name-confirmation.ts'

assert.equal(hasConfirmedFullName(null), false, 'missing record is not confirmed')
assert.equal(hasConfirmedFullName({ full_name: 'Michael Milam', full_name_confirmed_at: '2026-06-17T00:00:00Z' }), true, 'name plus confirmation counts')
assert.equal(hasConfirmedFullName({ full_name: 'Michael Milam', full_name_confirmed_at: null }), false, 'legacy unconfirmed name does not count')
assert.equal(hasConfirmedFullName({ full_name: '   ', full_name_confirmed_at: '2026-06-17T00:00:00Z' }), false, 'blank confirmed name does not count')

assert.equal(
  entryNeedsConfirmedFullName({ full_name: '', full_name_confirmed_at: null }, { full_name: 'Michael Milam', full_name_confirmed_at: '2026-06-17T00:00:00Z' }),
  false,
  'confirmed account full name suppresses entry-level full-name prompt',
)
assert.equal(
  entryNeedsConfirmedFullName({ full_name: 'Michael Milam', full_name_confirmed_at: '2026-06-17T00:00:00Z' }, null),
  false,
  'confirmed entry full name suppresses prompt without account profile',
)
assert.equal(
  entryNeedsConfirmedFullName({ full_name: '', full_name_confirmed_at: null }, { full_name: 'Michael Milam', full_name_confirmed_at: null }),
  true,
  'unconfirmed account full name does not suppress prompt',
)
assert.equal(
  entryNeedsConfirmedFullName({ full_name: '', full_name_confirmed_at: null }, null),
  true,
  'missing entry and missing account full name still prompts',
)

const appLayout = readFileSync('src/app/(app)/layout.tsx', 'utf8')
const fullNameReminderRoute = readFileSync('src/app/api/ops/full-name-reminders/route.ts', 'utf8')
const signupRoute = readFileSync('src/app/api/auth/signup/route.ts', 'utf8')

assert.ok(appLayout.includes("import { entryNeedsConfirmedFullName, hasConfirmedFullName } from '@/lib/full-name-confirmation'"), 'app layout must use shared full-name confirmation helper')
assert.ok(appLayout.includes('entryNeedsConfirmedFullName(entry, profile)'), 'app-wide full-name prompt must consider the signed-in account profile')
assert.ok(fullNameReminderRoute.includes(".select('id, full_name, full_name_confirmed_at')"), 'full-name reminder route must load account profiles')
assert.ok(fullNameReminderRoute.includes('profileByUserId'), 'full-name reminder route must map account profiles')
assert.ok(fullNameReminderRoute.includes('entryNeedsConfirmedFullName(entry, accountProfile)'), 'full-name reminder email route must suppress accounts with confirmed profile full names')
assert.ok(signupRoute.includes('full_name_confirmed_at: confirmedAt'), 'account signup must mark the typed full name as confirmed')
assert.ok(signupRoute.includes(".from('gpp_profiles')"), 'account signup must create a profile row for the typed full name')
assert.ok(signupRoute.includes('full_name: fullName'), 'account signup must copy the typed full name into the profile')

console.log('full-name reminder account fallback verified')
