import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getPoolPaymentStatus } from '../src/lib/payments/pricing'
import { auditProdReadiness } from '../src/lib/prod-readiness'
import { deriveBoardVisibility, derivePaymentState, entriesMissingFrozenResults, finalPool, lockedOrScoring, picksAreVisibleForPool, poolDashboardStatus, poolIsActiveForDashboard, tournamentHasScoringEvidence } from '../src/lib/pool-state'
import { shouldPreserveLiveTournamentStatus } from '../src/lib/tournament-sync'

assert.equal(getPoolPaymentStatus('active', 18, 0), 'payment_due', 'stored active cannot hide a real balance due')
assert.equal(getPoolPaymentStatus('archived_unpaid', 5, 0), 'active', 'free/paid pools recover to active')

const finalArchivedPool = { id: 'pool-final', name: 'Final', is_completed: true, payment_status: 'archived_unpaid' }
const completedTournament = { id: 't1', name: 'Finished Event', status: 'completed', leaderboard_json: [{ name: 'Scottie Scheffler' }] }
assert.equal(finalPool(finalArchivedPool, completedTournament), true, 'completed tournament/pool resolves as final')
assert.equal(lockedOrScoring({ is_locked: false }, { status: 'live', leaderboard_json: [] }), true, 'live tournament resolves as scoring')
assert.equal(lockedOrScoring({ is_completed: true }, { status: 'upcoming', leaderboard_json: [] }), true, 'completed pool resolves as locked/scoring even if tournament row is stale')
assert.equal(tournamentHasScoringEvidence({ status: 'upcoming', start_date: '2026-06-22', end_date: '2026-06-22', leaderboard_json: [{ name: 'Scottie Scheffler' }] }, new Date('2026-06-22T16:00:00Z')), true, 'date-window leaderboard rows count as scoring evidence')
assert.equal(poolDashboardStatus({ is_locked: false }, { status: 'upcoming', start_date: '2026-06-22', end_date: '2026-06-22', leaderboard_json: [{ name: 'Scottie Scheffler' }] }, new Date('2026-06-22T16:00:00Z')), 'Live', 'dashboard status stays Live when ESPN status downgrades but board rows exist')
assert.equal(poolIsActiveForDashboard({ is_completed: false }, { status: 'upcoming', start_date: '2026-06-22', end_date: '2026-06-22', leaderboard_json: [{ name: 'Scottie Scheffler' }] }, new Date('2026-06-22T16:00:00Z')), true, 'dashboard keeps downgraded in-window scoring pool active')
assert.equal(picksAreVisibleForPool({ is_locked: false }, { status: 'upcoming', start_date: '2026-06-22', end_date: '2026-06-22', leaderboard_json: [{ name: 'Scottie Scheffler' }] }, new Date('2026-06-22T16:00:00Z')), true, 'picks reveal when scoring evidence exists even if status says upcoming')
assert.deepEqual(
  deriveBoardVisibility({ pool: finalArchivedPool, tournament: completedTournament }),
  { state: 'visible_final', canShowLeaderboard: true, hiddenByBilling: false },
  'final board visibility is independent of billing/archive state'
)
assert.equal(derivePaymentState({ storedStatus: 'active', activeEntryCount: 18, amountPaidCents: 0 }).amountDueCents, 1300)

const frozenMissing = entriesMissingFrozenResults([
  { id: 'ok', is_removed: false, golfer_picks: ['Rory McIlroy'], rank: 1, total_score: -8, counting_scores: [{ name: 'Rory McIlroy' }] },
  { id: 'missing', is_removed: false, golfer_picks: ['Scottie Scheffler'], rank: null, total_score: null, counting_scores: null },
  { id: 'empty-picks', is_removed: false, golfer_picks: [], rank: null, total_score: null, counting_scores: [] },
  { id: 'removed', is_removed: true, golfer_picks: ['Rory McIlroy'], rank: null, total_score: null, counting_scores: null },
])
assert.deepEqual(frozenMissing.map(entry => entry.id), ['missing'], 'frozen-result check ignores removed entries and no-pick entries')

const now = new Date('2026-06-22T15:00:00Z')
const audit = auditProdReadiness({
  checkedAt: now,
  usingServiceRole: true,
  includeTestPools: true,
  pools: [
    {
      id: 'pool-final',
      name: 'Final archived',
      is_completed: true,
      payment_status: 'archived_unpaid',
      gpp_tournaments: completedTournament,
    },
    {
      id: 'pool-active-due',
      name: 'Active but due',
      is_locked: true,
      payment_status: 'active',
      amount_paid_cents: 0,
      gpp_tournaments: { id: 't2', name: 'Live Event', status: 'live', leaderboard_json: [{ name: 'Rory McIlroy' }], last_scores_fetch: '2026-06-22T14:40:00Z' },
    },
    {
      id: 'pool-upcoming',
      name: 'Grouped due',
      game_format: 'ranked_groups',
      groups_finalized_at: null,
      payment_status: 'draft',
      gpp_tournaments: { id: 't3', name: 'Near Event', status: 'upcoming', start_date: '2026-06-24', end_date: '2026-06-27', field_json: [], last_field_fetch: null },
    },
  ],
  entries: [
    { id: 'e1', pool_id: 'pool-final', is_removed: false, golfer_picks: ['Scottie Scheffler'], rank: null, total_score: null, counting_scores: null },
    { id: 'e2', pool_id: 'pool-active-due', is_removed: false },
    { id: 'e3', pool_id: 'pool-active-due', is_removed: false },
    { id: 'e4', pool_id: 'pool-active-due', is_removed: false },
    { id: 'e5', pool_id: 'pool-active-due', is_removed: false },
    { id: 'e6', pool_id: 'pool-active-due', is_removed: false },
    { id: 'e7', pool_id: 'pool-active-due', is_removed: false },
  ],
  cronRuns: [],
  fieldWindowDays: 14,
})
const codes = new Set(audit.issues.map(issue => issue.code))
for (const expected of ['FINAL_POOL_ARCHIVED_UNPAID', 'FINAL_POOL_MISSING_FROZEN_RESULTS', 'ACTIVE_STATUS_WITH_BALANCE_DUE', 'LIVE_SCORE_STALE', 'UPCOMING_POOL_FIELD_NOT_READY', 'UPCOMING_POOL_FIELD_STALE', 'GROUPED_POOL_DUE_WITHOUT_GROUPS', 'NO_CRON_RUN_HISTORY']) {
  assert.equal(codes.has(expected), true, `prod-readiness audit should emit ${expected}`)
}

const liveTournamentFixture = JSON.parse(readFileSync(join('test-fixtures', 'live-tournament', 'us-open-2026-round-3-live.json'), 'utf8'))
const staleStatusReadiness = auditProdReadiness({
  checkedAt: new Date(liveTournamentFixture.scenarioNow),
  usingServiceRole: true,
  includeTestPools: true,
  pools: [{
    ...liveTournamentFixture.pools[0],
    name: 'Replay pool',
    gpp_tournaments: { ...liveTournamentFixture.tournament, status: 'upcoming' },
  }],
  entries: [],
  cronRuns: [],
})
assert.equal(staleStatusReadiness.issues.some(issue => issue.code === 'TOURNAMENT_STATUS_STALE_WITH_LEADERBOARD'), true, 'prod-readiness audit catches replayed status downgrade with saved live fixture')
assert.equal(
  shouldPreserveLiveTournamentStatus('upcoming', { status: 'live', leaderboard_json: liveTournamentFixture.tournament.leaderboard_json }, liveTournamentFixture.tournament, new Date(liveTournamentFixture.scenarioNow)),
  true,
  'live sync preserves live status when ESPN downgrades an in-window tournament with stored leaderboard rows'
)
assert.equal(
  shouldPreserveLiveTournamentStatus('upcoming', { status: 'live', leaderboard_json: liveTournamentFixture.tournament.leaderboard_json }, { ...liveTournamentFixture.tournament, start_date: '2026-07-01', end_date: '2026-07-04' }, new Date(liveTournamentFixture.scenarioNow)),
  false,
  'live sync does not preserve stale live status outside the tournament window'
)

const defaultAuditSkipsTestFixtures = auditProdReadiness({
  checkedAt: now,
  usingServiceRole: true,
  pools: [{ id: 'qa-1', name: 'QA Dashboard Tee Times 20260617', gpp_tournaments: { name: 'QA Event', status: 'live', leaderboard_json: [], last_scores_fetch: null } }],
  entries: [],
  cronRuns: [],
})
assert.equal(defaultAuditSkipsTestFixtures.issues.some(issue => issue.code === 'LIVE_TOURNAMENT_EMPTY_LEADERBOARD'), false, 'default prod readiness skips QA/test fixtures')
assert.equal(defaultAuditSkipsTestFixtures.skippedTestPools, 1, 'prod readiness reports skipped QA/test fixture count')

const pricing = readFileSync('src/lib/payments/pricing.ts', 'utf8')
const archiveUnpaid = readFileSync('src/app/api/cron/archive-unpaid-pools/route.ts', 'utf8')
const poolView = readFileSync('src/app/(app)/pool/[id]/PoolView.tsx', 'utf8')
const tournamentSync = readFileSync('src/lib/tournament-sync.ts', 'utf8')
const paymentEmail = readFileSync('src/lib/pool-transactional-emails.ts', 'utf8')

assert.equal(pricing.includes('isPaymentHideGraceActive'), false, 'temporary payment-hide grace table should be gone')
assert.equal(archiveUnpaid.includes('isPaymentHideGraceActive'), false, 'archive cron should not depend on temporary pool-specific grace')
assert.ok(
  archiveUnpaid.includes("String(tournament.status || '').toLowerCase() !== 'completed'")
    && archiveUnpaid.includes(".eq('is_completed', false)")
    && archiveUnpaid.includes(".is('results_finalized_at', null)"),
  'archive-unpaid cron must not mutate completed/final pools'
)
assert.equal(poolView.includes('leaderboardIsHidden'), false, 'pool view should not retain dead billing-based leaderboard-hide state')
assert.equal(poolView.includes('Leaderboard hidden until the pool fee is paid'), false, 'billing-blocked leaderboard copy should not exist')
assert.ok(poolView.includes('tournamentHasScoringEvidence(tournamentWithCurrentLeaderboard)'), 'pool view scoring state should use shared pool-state scoring evidence')
assert.ok(poolView.includes('lockedOrScoring(effectivePoolState, tournamentWithCurrentLeaderboard)'), 'pool view pick/payment lock state should use shared pool-state locked/scoring helper')
assert.ok(poolView.includes('setLeaderboardLastUpdated(data.lastScoresFetch || null)'), 'client score freshness should use stored API timestamp')
assert.ok(tournamentSync.includes('async function fetchScoreboardEventById(eventId: string)'), 'live sync should support direct event fetch by external_id')
assert.ok(tournamentSync.includes('for (const externalId of activation.activatedExternalIds)'), 'live sync should direct-fetch activated DB tournaments')
assert.ok(paymentEmail.includes('Entries, picks, and leaderboards stay visible') && !paymentEmail.includes('temporarily hide the leaderboard'), 'payment reminders should not promise leaderboard hiding')

console.log('reliability hardening model verified')
