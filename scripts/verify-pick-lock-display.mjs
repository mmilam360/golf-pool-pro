import assert from 'node:assert/strict'
import { getPickLockBadgeText } from '../src/lib/pick-lock-display.ts'

assert.equal(
  getPickLockBadgeText({
    lockAt: null,
    groupsFinalizedAt: '2026-06-02T22:02:00Z',
    tournamentStartDate: '2026-06-04',
    fieldJson: [{ teeTime: '2026-06-04T10:57:00Z' }, { teeTime: '2026-06-04T11:08:00Z' }],
  }),
  '6/4 6:52am',
  'upcoming pools show the first tee lock time, not the group lock date'
)
assert.equal(
  getPickLockBadgeText({ lockAt: '2026-06-04T11:55:00Z', groupsFinalizedAt: '2026-06-02T22:02:00Z', tournamentStartDate: '2026-06-04' }),
  '6/4 7:55am',
  'actual pick lock time wins when present'
)
assert.equal(
  getPickLockBadgeText({ lockAt: null, groupsFinalizedAt: null, tournamentStartDate: '2026-06-04T00:00:00Z' }),
  '6/4',
  'date fallback omits leading zeroes when tee times are unavailable'
)
assert.equal(
  getPickLockBadgeText({ lockAt: null, groupsFinalizedAt: '2026-06-02T22:02:00Z', tournamentStartDate: null }),
  null,
  'group lock alone should not create a picks lock label'
)

console.log('pick lock display rules verified')
