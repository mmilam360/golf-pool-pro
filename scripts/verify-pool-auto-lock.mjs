import assert from 'node:assert/strict'
import { firstTeeTimeFromField, groupsAreReady, tournamentIsDueToLock, tournamentIsInLiveActivationWindow } from '../src/lib/pool-auto-lock.ts'
import { liveSyncActivationForTournament } from '../src/lib/tournament-sync.ts'

const today = '2026-06-04'
const firstTee = '2026-06-04T12:00:00Z'

assert.equal(tournamentIsDueToLock(null, today), false, 'missing tournament is not due')
assert.equal(tournamentIsDueToLock({ id: 't1', start_date: '2026-06-05', status: 'upcoming' }, today), false, 'future upcoming tournament is not due')
assert.equal(tournamentIsDueToLock({ id: 't1', start_date: '2026-06-04', status: 'upcoming' }, today), true, 'start-date tournament without tee times is due')
assert.equal(tournamentIsDueToLock({ id: 't1', start_date: '2026-06-03', status: 'upcoming' }, today), true, 'missed prior start date catches up')
assert.equal(tournamentIsDueToLock({ id: 't1', start_date: '2026-06-05', status: 'live' }, today), true, 'live tournament without tee times locks regardless of date')
assert.equal(tournamentIsDueToLock({ id: 't1', start_date: '2026-06-05', status: 'completed' }, today), true, 'completed tournament without tee times locks regardless of date')

assert.equal(firstTeeTimeFromField([{ teeTime: '2026-06-04T12:20:00Z' }, { teeTime: firstTee }])?.getTime(), new Date(firstTee).getTime(), 'first tee picks earliest valid tee time')
assert.equal(tournamentIsDueToLock({ id: 't1', start_date: today, status: 'upcoming', field_json: [{ teeTime: firstTee }] }, today, new Date('2026-06-04T11:54:59Z')), false, 'tee-time tournament waits until five-minute lock window')
assert.equal(tournamentIsDueToLock({ id: 't1', start_date: today, status: 'upcoming', field_json: [{ teeTime: firstTee }] }, today, new Date('2026-06-04T11:55:00Z')), true, 'tee-time tournament locks five minutes before first tee')
assert.equal(tournamentIsDueToLock({ id: 't1', start_date: today, status: 'live', field_json: [{ teeTime: firstTee }] }, today, new Date('2026-06-04T11:54:59Z')), false, 'stored tee times beat early live status before the lock window')
assert.equal(tournamentIsDueToLock({ id: 't1', start_date: today, status: 'completed', field_json: [{ teeTime: firstTee }] }, today, new Date('2026-06-04T11:54:59Z')), false, 'stored tee times beat early completed status before the lock window')
assert.equal(tournamentIsInLiveActivationWindow({ id: 't1', status: 'upcoming', field_json: [{ teeTime: firstTee }] }, new Date('2026-06-04T11:54:59Z')), false, 'live sync stays cheap before first-tee window')
assert.equal(tournamentIsInLiveActivationWindow({ id: 't1', status: 'upcoming', field_json: [{ teeTime: firstTee }] }, new Date('2026-06-04T11:55:00Z')), true, 'live sync activates inside first-tee window')
assert.equal(tournamentIsInLiveActivationWindow({ id: 't1', status: 'live', field_json: [] }, new Date('2026-06-04T11:00:00Z')), true, 'live tournaments keep live sync active')
assert.deepEqual(liveSyncActivationForTournament({ external_id: 't1', start_date: today, status: 'upcoming', field_json: [{ teeTime: firstTee }] }, today, new Date('2026-06-04T11:54:59Z')), { shouldActivate: false, dateFallback: false }, 'minute live sync must not use date fallback before first tee when tee times exist')
assert.deepEqual(liveSyncActivationForTournament({ external_id: 't1', start_date: today, status: 'upcoming', field_json: [{ teeTime: firstTee }] }, today, new Date('2026-06-04T11:55:00Z')), { shouldActivate: true, dateFallback: false }, 'minute live sync activates inside tee window when tee times exist')
assert.deepEqual(liveSyncActivationForTournament({ external_id: 't1', start_date: today, status: 'upcoming', field_json: [] }, today, new Date('2026-06-04T00:05:00Z')), { shouldActivate: true, dateFallback: true }, 'date fallback only applies when tee times are missing')

assert.equal(groupsAreReady({ id: 'p1', game_format: 'standard' }), true, 'standard pools do not need group finalization')
assert.equal(groupsAreReady({ id: 'p1', game_format: 'ranked_groups', groups_finalized_at: null }), false, 'ranked pools wait for finalized groups')
assert.equal(groupsAreReady({ id: 'p1', game_format: 'ranked_groups', groups_finalized_at: '2026-06-02T12:00:00Z' }), true, 'ranked pools lock after group finalization')
assert.equal(groupsAreReady({ id: 'p1', game_format: 'random_groups', groups_finalized_at: '2026-06-02T12:00:00Z' }), true, 'random grouped pools lock after group finalization')

console.log('pool auto-lock rules verified')
