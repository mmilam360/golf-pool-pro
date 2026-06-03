import assert from 'node:assert/strict'
import { getPickLockBadgeText } from '../src/lib/pick-lock-display.ts'

assert.equal(
  getPickLockBadgeText({ lockAt: null, groupsFinalizedAt: '2026-06-02T22:02:00Z', tournamentStartDate: '2026-06-04' }),
  '06/04',
  'group lock time must not be shown as picks lock'
)
assert.equal(
  getPickLockBadgeText({ lockAt: '2026-06-04T11:55:00Z', groupsFinalizedAt: '2026-06-02T22:02:00Z', tournamentStartDate: '2026-06-04' }),
  '06/04 7:55am',
  'actual pick lock time wins when present'
)
assert.equal(
  getPickLockBadgeText({ lockAt: null, groupsFinalizedAt: null, tournamentStartDate: '2026-06-04T00:00:00Z' }),
  '06/04',
  'standard and grouped pools both fall back to tournament start date before lock'
)
assert.equal(
  getPickLockBadgeText({ lockAt: null, groupsFinalizedAt: '2026-06-02T22:02:00Z', tournamentStartDate: null }),
  null,
  'group lock alone should not create a picks lock label'
)

console.log('pick lock display rules verified')
