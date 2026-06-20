import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { APP_DATE_TIME_ZONE, getDateOnly, todayDateOnly } from '../src/lib/date-utils.ts'
import { hasOnCourseScores } from '../src/lib/golf-live.ts'
import { summarizeLiveScoringHealth } from '../src/lib/live-scoring-health.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturePath = join(__dirname, '..', 'test-fixtures', 'live-tournament', 'us-open-2026-round-3-live.json')
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
const now = new Date(fixture.scenarioNow)
const baseTournament = fixture.tournament
const pools = fixture.pools
const recentCron = [{
  route: '/api/cron/sync-tournaments?live=1',
  status: 'success',
  started_at: '2026-06-20T18:19:00.000Z',
  finished_at: '2026-06-20T18:19:04.000Z',
}]

function leaderboardRows(tournament) {
  return Array.isArray(tournament?.leaderboard_json) ? tournament.leaderboard_json.length : 0
}

function dateWindowIncludes(tournament, at) {
  const startDate = getDateOnly(tournament?.start_date || '')
  if (!startDate) return false
  const today = todayDateOnly(APP_DATE_TIME_ZONE, at)
  const endDate = getDateOnly(tournament?.end_date || '')
  return endDate ? startDate <= today && today <= endDate : startDate <= today
}

function tournamentIsInProgress(tournament, at) {
  if (tournament?.status === 'live') return true
  if (hasOnCourseScores(tournament?.leaderboard_json)) return true
  return dateWindowIncludes(tournament, at) && leaderboardRows(tournament) > 0
}

function poolIsActive(pool, tournament, at) {
  if (pool.is_completed || tournament?.status === 'completed') return false
  if (tournamentIsInProgress(tournament, at)) return true
  if (!tournament?.start_date) return true
  const today = todayDateOnly(APP_DATE_TIME_ZONE, at)
  const startDate = getDateOnly(tournament.start_date) || tournament.start_date
  const endDate = getDateOnly(tournament.end_date || '')
  if (endDate) return today <= endDate
  return startDate >= today
}

function collapsedCardStatus(pool, tournament, at) {
  if (pool.is_completed || tournament?.status === 'completed') return 'Passed'
  if (tournamentIsInProgress(tournament, at)) return 'Live'
  if (pool.is_locked) return 'Locked'
  return 'Open'
}

function picksAreVisible(pool, tournament) {
  return Boolean(pool.is_locked || tournament?.status === 'live' || tournament?.status === 'completed' || hasOnCourseScores(tournament?.leaderboard_json))
}

function healthFor(tournament, options = {}) {
  return summarizeLiveScoringHealth({
    tournaments: [tournament],
    pools,
    cronRuns: options.cronRuns || recentCron,
    staleAfterMinutes: 15,
    now,
  })
}

assert.equal(baseTournament.name, 'U.S. Open')
assert.equal(leaderboardRows(baseTournament), 156, 'fixture keeps a full live U.S. Open leaderboard')
assert.equal(hasOnCourseScores(baseTournament.leaderboard_json), true, 'fixture includes on-course live score evidence')

const healthy = healthFor(baseTournament)
assert.equal(healthy.ok, true, 'captured live fixture should pass health checks')
assert.equal(poolIsActive(pools[0], baseTournament, now), true, 'live fixture pool remains in Active Pools')
assert.equal(collapsedCardStatus(pools[0], baseTournament, now), 'Live', 'live fixture collapsed card shows Live')
assert.equal(picksAreVisible(pools[0], baseTournament), true, 'live fixture picks are visible/scorable')

const downgradedTournament = { ...baseTournament, status: 'upcoming' }
const downgradedHealth = healthFor(downgradedTournament)
assert.equal(poolIsActive(pools[0], downgradedTournament, now), true, 'date-window leaderboard evidence keeps downgraded tournament pool active')
assert.equal(collapsedCardStatus(pools[0], downgradedTournament, now), 'Live', 'downgraded tournament with rows does not show Locked')
assert.equal(downgradedHealth.ok, false, 'health catches upcoming status with live leaderboard rows')
assert.equal(downgradedHealth.issues.some(issue => issue.code === 'stale_tournament_status'), true, 'stale status issue is emitted')

const staleScoresTournament = { ...baseTournament, last_scores_fetch: '2026-06-20T17:00:00.000Z' }
const staleScoresHealth = healthFor(staleScoresTournament)
assert.equal(staleScoresHealth.ok, false, 'health catches stale score fetch during live/on-course play')
assert.equal(staleScoresHealth.issues.some(issue => issue.code === 'stale_live_scores' && issue.severity === 'critical'), true, 'stale live score issue is critical while players are on course')

const staleCronHealth = healthFor(baseTournament, {
  cronRuns: [{
    route: '/api/cron/sync-tournaments?live=1',
    status: 'success',
    started_at: '2026-06-20T17:30:00.000Z',
    finished_at: '2026-06-20T17:30:04.000Z',
  }],
})
assert.equal(staleCronHealth.ok, false, 'health catches stale live-sync cron history')
assert.equal(staleCronHealth.issues.some(issue => issue.code === 'live_sync_run_stale'), true, 'stale live sync issue is emitted')

const completedTournament = { ...baseTournament, status: 'completed' }
assert.equal(poolIsActive(pools[0], completedTournament, now), false, 'completed tournament drops out of Active Pools')
assert.equal(collapsedCardStatus(pools[0], completedTournament, now), 'Passed', 'completed tournament card shows Passed')

console.log('live tournament replay verified')
console.log(JSON.stringify({
  fixture: fixture.fixture,
  leaderboardRows: leaderboardRows(baseTournament),
  scenarios: ['healthy-live', 'status-downgrade', 'stale-scores', 'stale-cron', 'completed'],
}, null, 2))
