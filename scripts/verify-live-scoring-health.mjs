import assert from 'node:assert/strict'
import { summarizeLiveScoringHealth } from '../src/lib/live-scoring-health.ts'

const now = new Date('2026-06-20T12:00:00Z')
const baseTournament = {
  id: 'us-open',
  external_id: '401811952',
  name: 'U.S. Open',
  start_date: '2026-06-18',
  end_date: '2026-06-21',
}
const pool = { id: 'pool-1', tournament_id: 'us-open', is_locked: true, is_completed: false }
const recentCron = [{ route: '/api/cron/sync-tournaments?live=1', status: 'success', started_at: '2026-06-20T11:58:00Z', finished_at: '2026-06-20T11:58:02Z' }]

const staleStatus = summarizeLiveScoringHealth({
  tournaments: [{ ...baseTournament, status: 'upcoming', last_scores_fetch: '2026-06-20T11:58:00Z', leaderboard_json: [{ name: 'Scottie Scheffler', thru: '4' }] }],
  pools: [pool],
  cronRuns: recentCron,
  staleAfterMinutes: 15,
  now,
})
assert.equal(staleStatus.ok, false, 'upcoming tournament with in-window leaderboard rows should fail health')
assert.equal(staleStatus.issues.some(issue => issue.code === 'stale_tournament_status'), true, 'stale status issue is reported')

const healthy = summarizeLiveScoringHealth({
  tournaments: [{ ...baseTournament, status: 'live', last_scores_fetch: '2026-06-20T11:58:00Z', leaderboard_json: [{ name: 'Scottie Scheffler', thru: '4' }] }],
  pools: [pool],
  cronRuns: recentCron,
  staleAfterMinutes: 15,
  now,
})
assert.equal(healthy.ok, true, 'recent live board and recent cron run should pass health')

const staleCron = summarizeLiveScoringHealth({
  tournaments: [{ ...baseTournament, status: 'live', last_scores_fetch: '2026-06-20T11:58:00Z', leaderboard_json: [{ name: 'Scottie Scheffler', thru: '4' }] }],
  pools: [pool],
  cronRuns: [{ route: '/api/cron/sync-tournaments?live=1', status: 'success', started_at: '2026-06-20T11:00:00Z', finished_at: '2026-06-20T11:00:02Z' }],
  staleAfterMinutes: 15,
  now,
})
assert.equal(staleCron.ok, false, 'stale live cron history should fail health when live pools exist')
assert.equal(staleCron.issues.some(issue => issue.code === 'live_sync_run_stale'), true, 'stale cron issue is reported')

console.log('live scoring health verified')
