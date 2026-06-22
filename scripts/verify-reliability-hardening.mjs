import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pricing = readFileSync('src/lib/payments/pricing.ts', 'utf8')
const archiveUnpaid = readFileSync('src/app/api/cron/archive-unpaid-pools/route.ts', 'utf8')
const poolView = readFileSync('src/app/(app)/pool/[id]/PoolView.tsx', 'utf8')
const groupedAutoLock = readFileSync('src/lib/grouped-pool-auto-lock.ts', 'utf8')
const manualFinalizeGroups = readFileSync('src/app/api/pools/finalize-groups/route.ts', 'utf8')
const overrideFinalizeGroups = readFileSync('src/app/api/pools/finalize-groups-override/route.ts', 'utf8')
const tournamentSync = readFileSync('src/lib/tournament-sync.ts', 'utf8')
const paymentEmail = readFileSync('src/lib/pool-transactional-emails.ts', 'utf8')

assert.ok(
  pricing.includes("return 'payment_due'"),
  'any unpaid pool over the free/paid amount should resolve to payment_due unless explicitly archived/refunded'
)
assert.ok(
  pricing.indexOf('if (quote.amountDueCents <= 0) return \'active\'') < pricing.indexOf("if (storedStatus === 'archived_unpaid') return 'archived_unpaid'"),
  'free/fully-paid pools should recover from archived_unpaid to active'
)

assert.ok(
  archiveUnpaid.includes("String(tournament.status || '').toLowerCase() !== 'completed'") &&
  archiveUnpaid.includes(".eq('is_completed', false)") &&
  archiveUnpaid.includes(".is('results_finalized_at', null)"),
  'archive-unpaid cron must not mutate completed/final pools'
)

assert.ok(
  poolView.includes('const leaderboardIsHidden = false'),
  'pool/public boards should not be hidden by billing state'
)
assert.ok(
  !poolView.includes('isPaymentHideGraceActive'),
  'payment hide grace hacks should not control leaderboard visibility'
)
assert.ok(
  poolView.includes('setLeaderboardLastUpdated(data.lastScoresFetch || null)'),
  'client score freshness should use the stored API timestamp, not local browser time'
)

for (const source of [groupedAutoLock, manualFinalizeGroups, overrideFinalizeGroups]) {
  assert.ok(source.includes('fieldFingerprint'), 'group finalization paths should write field fingerprints when refreshing fields')
  assert.ok(source.includes('field_fingerprint: fieldFingerprint(fieldSnapshot)'), 'group finalization paths should persist fresh field fingerprints')
}
assert.ok(
  groupedAutoLock.includes('last_field_fetch') && groupedAutoLock.includes('lastUpdated = tournament?.last_field_fetch || null'),
  'grouped auto-lock stored-field fallback should pass last_field_fetch into field quality checks'
)

assert.ok(
  tournamentSync.includes('async function fetchScoreboardEventById(eventId: string)'),
  'live sync should support direct event fetch by external_id'
)
assert.ok(
  tournamentSync.includes('for (const externalId of activation.activatedExternalIds)') &&
  tournamentSync.includes('scoreboardEvents.push(event)'),
  'live sync should direct-fetch activated DB tournaments missing from the general scoreboard'
)
assert.ok(
  (tournamentSync.match(/finalBoardHasEnoughEvidence\(existing\.leaderboard_json\)/g) || []).length >= 2,
  'completed board preservation should require enough final evidence before blocking repair'
)

assert.ok(
  paymentEmail.includes('Entries, picks, and leaderboards stay visible') && !paymentEmail.includes('temporarily hide the leaderboard'),
  'payment reminders should not promise leaderboard hiding now that billing is decoupled from board visibility'
)

console.log('reliability hardening invariants verified')
