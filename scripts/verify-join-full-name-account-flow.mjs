import { readFileSync } from 'node:fs'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const joinPage = readFileSync('src/app/(app)/pool/join/page.tsx', 'utf8')
const accountPage = readFileSync('src/app/(app)/account/page.tsx', 'utf8')
const accountClient = readFileSync('src/components/AccountClient.tsx', 'utf8')
const signupRoute = readFileSync('src/app/api/auth/signup/route.ts', 'utf8')

assert(joinPage.includes('accountFullNameConfirmed'), 'join page must track whether the account full name is explicitly confirmed')
assert(joinPage.includes('accountHasDisplayName'), 'join page must know whether the account already has a default leaderboard name')
assert(joinPage.includes("select('display_name, full_name, full_name_confirmed_at')"), 'join page must load the confirmed account full-name fields')
assert(joinPage.includes('const profileDisplayName = profile?.display_name?.trim() || \'\''), 'signed-in join must use the stored profile display name as the entry-name default')
assert(joinPage.includes('setGuestName(current => current.trim() ? current : accountName)'), 'signed-in join must prefill the editable leaderboard name from the account default')
assert(
  joinPage.includes('const showFullNameInput = authChecked && (!isSignedIn || !accountFullNameConfirmed)'),
  'full-name input must be hidden for signed-in users who already have a confirmed full name',
)
assert(joinPage.includes('{showFullNameInput && ('), 'full-name field must be conditionally rendered')
assert(
  joinPage.includes('if (!accountFullNameConfirmed) {\n      profilePayload.full_name = runnerName\n      profilePayload.full_name_confirmed_at = confirmedAt\n    }'),
  'joining a new pool must not overwrite a confirmed account full name',
)
assert(
  joinPage.includes('if (!accountHasDisplayName) profilePayload.display_name = accountDefaultDisplayName || displayName'),
  'pool-specific entry names must not overwrite an existing account display-name default',
)
assert(
  !joinPage.includes('display_name: displayName,\n    }\n    if (!accountFullNameConfirmed)'),
  'profile upsert must not blindly save the pool-specific entry name as the account default',
)
assert(
  !joinPage.includes('display_name: displayName,\n        ...(!accountFullNameConfirmed'),
  'auth metadata must not save the pool-specific entry name as the account default',
)
assert(joinPage.includes('if (!leaderboardNameEdited) setGuestName(nextFullName.slice(0, 60))'), 'guest full name should auto-fill the leaderboard name until the guest edits it')
assert(joinPage.includes('Shown on this pool\'s leaderboard. Your account name stays the same.'), 'signed-in helper copy must make per-pool entry names clear')
assert(joinPage.includes('display_name: displayName'), 'signed-in join must still save the editable leaderboard name on the entry')
assert(joinPage.includes('full_name: runnerName'), 'new entry must still store the private full name copied from account or first capture')
assert(joinPage.includes('full_name_confirmed_at: confirmedAt'), 'new entry must mark the full name as confirmed')

assert(
  accountPage.includes("select('display_name, full_name, full_name_confirmed_at, email')"),
  'account page must load both default leaderboard name and private full name from gpp_profiles',
)
assert(
  accountClient.includes(".from('gpp_profiles')\n      .upsert({ id: user.id, email: user.email || email, display_name: trimmedName, full_name: trimmedFullName, full_name_confirmed_at: confirmedAt })"),
  'account settings must save both default leaderboard name and private full name to gpp_profiles',
)
assert(
  accountClient.includes('display_name: trimmedName,\n        full_name: trimmedFullName,'),
  'account settings must also keep auth metadata aligned for both names',
)
assert(
  signupRoute.includes('display_name: displayName,\n      full_name: fullName,\n      full_name_confirmed_at: confirmedAt,'),
  'signup must save both default leaderboard name and private full name to gpp_profiles',
)

console.log('join full-name account flow verifier passed')
