import assert from 'node:assert/strict'
import { groupsAreReady, tournamentIsDueToLock } from '../src/lib/pool-auto-lock.ts'

const today = '2026-06-04'

assert.equal(tournamentIsDueToLock(null, today), false, 'missing tournament is not due')
assert.equal(tournamentIsDueToLock({ id: 't1', start_date: '2026-06-05', status: 'upcoming' }, today), false, 'future upcoming tournament is not due')
assert.equal(tournamentIsDueToLock({ id: 't1', start_date: '2026-06-04', status: 'upcoming' }, today), true, 'start-date tournament is due')
assert.equal(tournamentIsDueToLock({ id: 't1', start_date: '2026-06-03', status: 'upcoming' }, today), true, 'missed prior start date catches up')
assert.equal(tournamentIsDueToLock({ id: 't1', start_date: '2026-06-05', status: 'live' }, today), true, 'live tournament locks regardless of date')
assert.equal(tournamentIsDueToLock({ id: 't1', start_date: '2026-06-05', status: 'completed' }, today), true, 'completed tournament locks regardless of date')

assert.equal(groupsAreReady({ id: 'p1', game_format: 'standard' }), true, 'standard pools do not need group finalization')
assert.equal(groupsAreReady({ id: 'p1', game_format: 'ranked_groups', groups_finalized_at: null }), false, 'ranked pools wait for finalized groups')
assert.equal(groupsAreReady({ id: 'p1', game_format: 'ranked_groups', groups_finalized_at: '2026-06-02T12:00:00Z' }), true, 'ranked pools lock after group finalization')
assert.equal(groupsAreReady({ id: 'p1', game_format: 'random_groups', groups_finalized_at: '2026-06-02T12:00:00Z' }), true, 'random grouped pools lock after group finalization')

console.log('pool auto-lock rules verified')
