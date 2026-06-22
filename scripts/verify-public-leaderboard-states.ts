import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { derivePublicLeaderboardState, sanitizePublicLeaderboardEntries } from '../src/lib/public-leaderboard-state'

const fixture = JSON.parse(readFileSync(join(process.cwd(), 'test-fixtures/live-tournament/us-open-2026-round-3-live.json'), 'utf8'))
const now = new Date(fixture.scenarioNow)

const baseEntry = {
  id: 'entry-1',
  pool_id: 'pool-1',
  display_name: 'Michael',
  golfer_picks: ['Wyndham Clark', 'Scottie Scheffler'],
  submitted_pick_count: null,
  total_score: -8,
  counting_scores: [{ name: 'Wyndham Clark', total: -4 }],
  rank: 1,
  is_removed: false,
  created_at: '2026-06-18T12:00:00Z',
  user_id: 'private-user-id',
  full_name: 'Private Name',
  full_name_confirmed_at: '2026-06-18T12:01:00Z',
  account_email: 'private@example.com',
  account_full_name: 'Private Account',
  account_full_name_confirmed_at: '2026-06-18T12:02:00Z',
  notification_email: 'notify@example.com',
  guest_entry_token_hash: 'private-token-hash',
}

const preLockTournament = {
  id: 't-upcoming',
  status: 'upcoming',
  start_date: '2026-06-25',
  end_date: '2026-06-28',
  leaderboard_json: [],
}

const preLockPool = {
  id: 'pool-1',
  is_locked: false,
  is_completed: false,
  payment_status: 'active',
}

const preLockState = derivePublicLeaderboardState(preLockPool, preLockTournament, now)
assert.deepEqual(preLockState, { picksAreVisible: false, preLockJoinOpen: true }, 'pre-lock public board hides picks and keeps join open')
const [hiddenEntry] = sanitizePublicLeaderboardEntries([baseEntry], preLockState.picksAreVisible)
assert.deepEqual(hiddenEntry.golfer_picks, [], 'pre-lock public board strips pick names')
assert.equal(hiddenEntry.picks_hidden, true, 'pre-lock public board marks picks hidden for PoolView')
assert.equal(hiddenEntry.submitted_pick_count, 2, 'pre-lock public board keeps submitted count for hidden picks')
assert.equal(hiddenEntry.user_id, null, 'public board strips user id')
assert.equal(hiddenEntry.account_email, '', 'public board strips account email')
assert.equal(hiddenEntry.notification_email, null, 'public board strips notification email')
assert.equal(hiddenEntry.guest_entry_token_hash, null, 'public board strips guest token hash')

const lockedState = derivePublicLeaderboardState({ ...preLockPool, is_locked: true }, preLockTournament, now)
assert.deepEqual(lockedState, { picksAreVisible: true, preLockJoinOpen: false }, 'locked public board shows submitted picks before scoring')
const [lockedEntry] = sanitizePublicLeaderboardEntries([baseEntry], lockedState.picksAreVisible)
assert.deepEqual(lockedEntry.golfer_picks, baseEntry.golfer_picks, 'locked public board keeps pick names visible')
assert.equal('picks_hidden' in lockedEntry, false, 'locked public board does not add hidden-pick marker')
assert.equal(lockedEntry.account_email, '', 'locked public board still strips private account email')

const liveTournamentWithStatusDowngrade = {
  ...fixture.tournament,
  status: 'upcoming',
}
const liveState = derivePublicLeaderboardState({ ...preLockPool, is_locked: false }, liveTournamentWithStatusDowngrade, now)
assert.deepEqual(liveState, { picksAreVisible: true, preLockJoinOpen: false }, 'live public board shows picks when leaderboard rows exist even if status downgrades')
const [liveEntry] = sanitizePublicLeaderboardEntries([baseEntry], liveState.picksAreVisible)
assert.deepEqual(liveEntry.golfer_picks, baseEntry.golfer_picks, 'live public board keeps picks visible')
assert.equal(liveEntry.total_score, -8, 'live public board keeps score data')
assert.deepEqual(liveEntry.counting_scores, baseEntry.counting_scores, 'live public board keeps counting scores')

const finalPool = {
  ...preLockPool,
  is_completed: false,
  results_finalized_at: '2026-06-22T12:00:00Z',
  payment_status: 'archived_unpaid',
}
const staleFinalTournament = {
  id: 't-final-stale',
  status: 'upcoming',
  start_date: '2026-06-18',
  end_date: '2026-06-21',
  leaderboard_json: [],
}
const finalState = derivePublicLeaderboardState(finalPool, staleFinalTournament, now)
assert.deepEqual(finalState, { picksAreVisible: true, preLockJoinOpen: false }, 'past/final public board stays visible even if tournament row is stale or archived unpaid')
const [finalEntry] = sanitizePublicLeaderboardEntries([baseEntry], finalState.picksAreVisible)
assert.deepEqual(finalEntry.golfer_picks, baseEntry.golfer_picks, 'past/final public board keeps pick names')
assert.equal(finalEntry.rank, 1, 'past/final public board keeps rank')
assert.equal(finalEntry.total_score, -8, 'past/final public board keeps total score')
assert.deepEqual(finalEntry.counting_scores, baseEntry.counting_scores, 'past/final public board keeps frozen result rows')

const hiddenMetadataEntry = { ...baseEntry, golfer_picks: [], submitted_pick_count: 6 }
const [hiddenMetadata] = sanitizePublicLeaderboardEntries([hiddenMetadataEntry], false)
assert.equal(hiddenMetadata.submitted_pick_count, 6, 'public hidden-pick masking preserves explicit submitted_pick_count metadata')

console.log('public leaderboard state scenarios verified')
