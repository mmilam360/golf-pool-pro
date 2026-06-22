import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { entryProcessIsClosed } from '../src/lib/entry-process-state'

const fixture = JSON.parse(readFileSync(join(process.cwd(), 'test-fixtures/live-tournament/us-open-2026-round-3-live.json'), 'utf8'))
const now = new Date(fixture.scenarioNow)

const openPool = { id: 'pool-open', is_locked: false, is_completed: false }
const upcomingTournament = {
  id: 't-upcoming',
  status: 'upcoming',
  start_date: '2026-06-25',
  end_date: '2026-06-28',
  leaderboard_json: [],
}
assert.equal(entryProcessIsClosed(openPool, upcomingTournament, now), false, 'entry process stays open before lock/scoring')
assert.equal(entryProcessIsClosed({ ...openPool, is_locked: true }, upcomingTournament, now), true, 'entry process closes when pool is locked')
assert.equal(entryProcessIsClosed({ ...openPool, is_completed: true }, upcomingTournament, now), true, 'entry process closes when pool is completed')
assert.equal(entryProcessIsClosed({ ...openPool, results_finalized_at: '2026-06-22T12:00:00Z', payment_status: 'archived_unpaid' }, upcomingTournament, now), true, 'entry process closes for finalized pools even if payment state is archived')
assert.equal(entryProcessIsClosed(openPool, { ...upcomingTournament, status: 'live' }, now), true, 'entry process closes when tournament status is live')
assert.equal(entryProcessIsClosed(openPool, { ...upcomingTournament, status: 'completed' }, now), true, 'entry process closes when tournament status is completed')

const statusDowngradedLiveTournament = {
  ...fixture.tournament,
  status: 'upcoming',
}
assert.equal(entryProcessIsClosed(openPool, statusDowngradedLiveTournament, now), true, 'entry process closes when scoreboard rows prove scoring even if status downgrades')

console.log('entry process state verified')
