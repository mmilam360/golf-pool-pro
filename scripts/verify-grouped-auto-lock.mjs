import assert from 'node:assert/strict'
import { autoLockDateForTournament, shouldAutoFinalizeGroups } from '../src/lib/grouped-pool-auto-lock-timing.ts'

assert.equal(autoLockDateForTournament('2026-05-28'), '2026-05-26')

assert.equal(
  shouldAutoFinalizeGroups('2026-05-28', { date: '2026-05-25', hour: 12 }),
  false,
  'does not lock before Tuesday'
)

assert.equal(
  shouldAutoFinalizeGroups('2026-05-28', { date: '2026-05-26', hour: 7 }),
  false,
  'does not lock before Tuesday morning'
)

assert.equal(
  shouldAutoFinalizeGroups('2026-05-28', { date: '2026-05-26', hour: 8 }),
  true,
  'locks starting Tuesday morning'
)

assert.equal(
  shouldAutoFinalizeGroups('2026-05-28', { date: '2026-05-27', hour: 9 }),
  true,
  'stays eligible after Tuesday if a cron run was missed'
)

console.log('grouped auto-lock timing checks passed')
