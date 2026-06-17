import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/DashboardActivePools.tsx', 'utf8')

assert.ok(
  source.includes('function formatEntryCount(count: number)') && source.includes("return `${count} ${count === 1 ? 'entry' : 'entries'}`"),
  'dashboard pool cards should format entry counts with singular/plural labels'
)

assert.ok(
  source.includes('grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2'),
  'dashboard pool-card header should keep pool name and entry count inline'
)

assert.ok(
  source.includes('{formatEntryCount(poolEntries.length)}'),
  'dashboard pool-card header should use the active entry count for each pool'
)

assert.ok(
  !source.includes('waitingForLiveScores'),
  'dashboard should not hide runner/player boards behind a separate syncing state before showing stored standings/field data'
)

assert.ok(
  source.includes('const showPreScoringWaiting = !scoringIsLive && !hasSubmittedPicks'),
  'pre-scoring entry rows should show Waiting only when that entry has no submitted picks'
)

assert.ok(
  source.includes('leaderboard={effectiveTournament?.leaderboard_json?.length ? effectiveTournament.leaderboard_json : effectiveTournament?.field_json}'),
  'expanded active-pool cards should always render the full tournament leaderboard with field fallback'
)

assert.ok(
  source.includes('const leaderboardByName = playerStatusByName(leaderboardRows, fieldRows)'),
  'dashboard pick status labels should merge field rows so tee times remain available before/live scoring'
)

console.log('dashboard runner/player parity verified')
