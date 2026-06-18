import { readFileSync } from 'node:fs'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const joinPage = readFileSync('src/app/(app)/pool/join/page.tsx', 'utf8')

assert(joinPage.includes('accountFullNameConfirmed'), 'join page must track whether the account full name is explicitly confirmed')
assert(joinPage.includes("select('display_name, full_name, full_name_confirmed_at')"), 'join page must load the confirmed account full-name fields')
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
  joinPage.includes('...(!accountFullNameConfirmed ? { full_name: runnerName } : {})'),
  'auth metadata full_name should only be written when the join form is collecting it',
)
assert(joinPage.includes('display_name: displayName'), 'signed-in join must still save the editable leaderboard name')
assert(joinPage.includes('full_name: runnerName'), 'new entry must still store the private full name copied from account or first capture')
assert(joinPage.includes('full_name_confirmed_at: confirmedAt'), 'new entry must mark the full name as confirmed')

console.log('join full-name account flow verifier passed')
