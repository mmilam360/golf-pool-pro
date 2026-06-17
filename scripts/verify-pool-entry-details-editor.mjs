import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const poolView = readFileSync('src/app/(app)/pool/[id]/PoolView.tsx', 'utf8')
const accountRoute = readFileSync('src/app/api/pool/account-entry/route.ts', 'utf8')

assert.ok(
  poolView.includes('const entryDetailsPanel = !guestMode && myEntry ? ('),
  'PoolView should render a visible signed-in entry details panel'
)
assert.ok(
  poolView.includes('Change your leaderboard name'),
  'entry details panel should make leaderboard-name editing clear'
)
assert.ok(
  poolView.includes('Leaderboard name is public. Full name stays private for the runner.'),
  'entry details panel should explain public vs private name use'
)
assert.ok(
  poolView.includes('{entryDetailsPanel}'),
  'My Entry view should include the visible entry details panel'
)
assert.ok(
  poolView.indexOf('{entryDetailsPanel}') < poolView.indexOf('{showSelectedPicks && ('),
  'entry details panel should appear above selected picks and the long golfer list'
)
assert.ok(
  !poolView.includes('<span>Entry details</span>\n                  <span className="border border-stone-300 px-1.5 py-0.5 text-[10px] group-open:hidden">Edit</span>'),
  'old buried Entry details accordion should be removed'
)
assert.ok(
  poolView.includes("disabled={entryNameSaving || picksAreLocked || !entryNameValue.trim() || !fullNameValue.trim() || !entryDetailsDirty}"),
  'entry details save should be disabled after picks lock'
)
assert.ok(
  poolView.includes("updatedEntry = await updateAccountEntry({ displayName: nextName, fullName: nextFullName })"),
  'signed-in entry details should save through account-entry API'
)
assert.ok(
  accountRoute.includes('if (body.displayName !== undefined)') && accountRoute.includes('entryNameTaken'),
  'account-entry API should validate display-name updates server-side'
)
assert.ok(
  accountRoute.includes("if (picksClosed) return NextResponse.json({ error: 'Entry names are locked for this pool.' }, { status: 409 })"),
  'account-entry API should reject entry-name changes after picks lock'
)

console.log('pool entry details editor verified')
