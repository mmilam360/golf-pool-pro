import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dashboard = readFileSync('src/components/DashboardActivePools.tsx', 'utf8')
const dashboardPage = readFileSync('src/app/(app)/dashboard/page.tsx', 'utf8')
const poolView = readFileSync('src/app/(app)/pool/[id]/PoolView.tsx', 'utf8')

assert.ok(
  dashboard.includes('function formatEntryCount(count: number)') && dashboard.includes("return `${count} ${count === 1 ? 'entry' : 'entries'}`"),
  'dashboard pool cards should format entry counts with singular/plural labels'
)

assert.ok(
  dashboard.includes('className="flex min-w-0 items-center gap-1.5"') && dashboard.includes('className="min-w-0 flex-1 truncate pb-0.5 text-lg font-black leading-tight text-[#0f2f25] sm:text-xl" title={pool.name}>{pool.name}</p>'),
  'dashboard pool-card header should keep pool name readable with flexible truncation'
)

assert.ok(
  dashboard.includes('{formatEntryCount(entries.length)}'),
  'dashboard expanded board header should show the active entry count for each pool'
)

assert.ok(
  !dashboard.includes('waitingForLiveScores'),
  'dashboard should not hide runner/player boards behind a separate syncing state before showing stored standings/field data'
)

assert.ok(
  dashboard.includes('const showPreScoringWaiting = !scoringIsLive && !hasSubmittedPicks'),
  'pre-scoring entry rows should show Waiting only when that entry has no submitted picks'
)

assert.ok(
  dashboard.includes('leaderboard={effectiveTournament?.leaderboard_json?.length ? effectiveTournament.leaderboard_json : effectiveTournament?.field_json}'),
  'expanded active-pool cards should always render the full tournament leaderboard with field fallback'
)

assert.ok(
  (dashboardPage.match(/gpp_tournaments\([^)]*field_json[^)]*leaderboard_json/g) || []).length >= 3,
  'dashboard page should select tournament field/leaderboard JSON through pool relationships so RLS cannot leave the expanded tournament leaderboard empty'
)

assert.ok(
  poolView.includes('leaderboard={leaderboard.length ? leaderboard : field}') && poolView.includes('defaultOpen\n                pickedGolfers={myPicks}'),
  'pool page should also open the full tournament leaderboard by default and fall back to field rows before scoring'
)

assert.ok(
  dashboard.includes('const leaderboardByName = playerStatusByName(leaderboardRows, fieldRows)'),
  'dashboard pick status labels should merge field rows so tee times remain available before/live scoring'
)

const sharedParitySnippets = [
  'gpp-board-frame border-[10px] border-[#123c2f] md:border-[16px]',
  'gpp-score-face border-2 border-[#d8b45d] bg-[#f7f7f2] text-center',
  'grid min-h-[58px] cursor-pointer list-none grid-cols-[34px_minmax(0,1fr)_58px_18px]',
  'w-full table-fixed border-collapse text-[12px] text-[#111]',
  'border-b-2 border-r-2 border-[#d8cab0]',
]
for (const snippet of sharedParitySnippets) {
  assert.ok(dashboard.includes(snippet), `dashboard board should keep pool-page visual parity for: ${snippet}`)
  assert.ok(poolView.includes(snippet), `pool page should contain the matching board snippet for: ${snippet}`)
}

assert.ok(
  dashboard.includes('mx-auto max-w-[66%] truncate text-xl font-black uppercase leading-none tracking-[0.1em] text-[#111] sm:max-w-[76%] sm:text-3xl sm:tracking-[0.16em]') &&
  poolView.includes('mx-auto max-w-[84%] truncate text-xl font-black uppercase leading-none tracking-[0.1em] text-[#111] sm:max-w-[88%] sm:text-3xl sm:tracking-[0.16em]'),
  'dashboard and pool page should keep the accepted board title treatment with dashboard allowing room for entry-count badge'
)

assert.ok(
  dashboard.includes('gpp-board-post relative z-0 mx-auto -mt-[4px] h-36 w-20') &&
  poolView.includes('gpp-board-post mx-auto -mt-[4px] h-36 w-20'),
  'dashboard and pool page should keep matching board posts, with dashboard post layered behind sticky dashboard controls'
)

console.log('dashboard runner/player parity verified')
