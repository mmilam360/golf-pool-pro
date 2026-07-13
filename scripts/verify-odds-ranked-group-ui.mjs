import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const groupedGrid = readFileSync(new URL('../src/components/GroupedPickGrid.tsx', import.meta.url), 'utf8')
const poolView = readFileSync(new URL('../src/app/(app)/pool/[id]/PoolView.tsx', import.meta.url), 'utf8')
const poolPage = readFileSync(new URL('../src/app/(app)/pool/[id]/page.tsx', import.meta.url), 'utf8')

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
assert.match(poolPage, /odds_snapshot_json/, 'the pool page loads the tournament odds snapshot')
assert.match(
  poolView,
  /oddsSnapshot:\s*tournament\?\.odds_snapshot_json/,
  'unfinalized ranked-pool previews use the tournament odds snapshot'
)
assert.match(
  poolView,
  /Tournament odds set the tiers/,
  'odds-backed ranked previews explain the ordering in plain language'
)

console.log('odds-backed ranked group UI checks passed')
