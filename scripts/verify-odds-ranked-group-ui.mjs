import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const groupedGrid = readFileSync(new URL('../src/components/GroupedPickGrid.tsx', import.meta.url), 'utf8')
const poolView = readFileSync(new URL('../src/app/(app)/pool/[id]/PoolView.tsx', import.meta.url), 'utf8')
const poolPage = readFileSync(new URL('../src/app/(app)/pool/[id]/page.tsx', import.meta.url), 'utf8')
const createPage = readFileSync(new URL('../src/app/(app)/pool/create/page.tsx', import.meta.url), 'utf8')

assert.match(groupedGrid, /rankSource/, 'new ranked snapshots identify their ranking source')
assert.match(
  groupedGrid,
  /preserveRankedOrder\s*\?\s*group\.players/,
  'new ranked snapshots preserve their frozen favorite-to-longshot order'
)
assert.match(
  groupedGrid,
  /\[\.\.\.group\.players\]\.sort/,
  'legacy and random group snapshots keep their existing alphabetical row presentation'
)
assert.match(groupedGrid, /rankingLabel/, 'grouped pick rows show odds and OWGR metadata')
assert.match(groupedGrid, /americanOdds/, 'grouped pick rows can display frozen American odds')
assert.match(groupedGrid, /OWGR/, 'grouped pick rows label the OWGR fallback')
assert.doesNotMatch(groupedGrid, /mx-auto w-fit/, 'ranked tier cards are left-aligned instead of centered in a wide panel')
assert.match(groupedGrid, /grid w-full overflow-hidden[^`]*sm:grid-cols-2/, 'ranked tier cards use the full panel width with two compact columns on desktop')
assert.match(groupedGrid, /grid-cols-\[5\.75rem_minmax\(0,1fr\)_auto\]/, 'ranked tier rows reserve a left odds\/OWGR rail')
assert.match(groupedGrid, /No rank/, 'unranked golfers get an explicit no-rank label in the odds\/rank rail')
assert.match(poolPage, /odds_snapshot_json/, 'the pool page loads the tournament odds snapshot')
assert.match(
  poolView,
  /oddsSnapshot:\s*tournament\?\.odds_snapshot_json/,
  'unfinalized ranked-pool previews use the tournament odds snapshot'
)
assert.match(
  poolView,
  /picksPerGroup:\s*Number\(pool\.picks_per_group \|\| 1\)/,
  'ranked-pool previews pass picks-per-tier into progressive tier sizing'
)
assert.match(
  poolView,
  /Tournament odds set the tiers/,
  'odds-backed ranked previews explain the ordering in plain language'
)
assert.match(createPage, /MAX_POOL_PICKS/, 'create form uses the shared 12-pick cap')
assert.doesNotMatch(createPage, /max=\{30\}/, 'Open Picks cannot drift back to 30 picks')
assert.match(createPage, /max=\{groupedMaxPicksPerGroup\}/, 'picks per tier/group is capped by the 12-pick entry maximum')
assert.match(createPage, /Progressive tiers keep the top ranks tighter/, 'ranked-pool setup explains progressive tiers')

console.log('odds-backed ranked group UI checks passed')
