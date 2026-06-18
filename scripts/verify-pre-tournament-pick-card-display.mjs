import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dashboard = readFileSync('src/components/DashboardActivePools.tsx', 'utf8')
const poolView = readFileSync('src/app/(app)/pool/[id]/PoolView.tsx', 'utf8')
const pickCardLayout = readFileSync('src/lib/pick-card-layout.ts', 'utf8')

for (const [label, source] of [['dashboard', dashboard], ['pool page', poolView]]) {
  assert.ok(
    source.includes('function sortPickNamesForPreScoring(names: string[], playerByName: Map<string, GolfPlayer>)'),
    `${label} should sort pre-tournament pick names through the shared tee-time/last-name helper`
  )
  assert.ok(
    source.includes('const hasTeeTimes = names.some(name => parsedTeeTimeMs(playerByName.get(normalizePickName(name))) !== null)'),
    `${label} should switch pre-tournament pick ordering when tee times are present`
  )
  assert.ok(
    source.includes('const aTeeTime = parsedTeeTimeMs(aPlayer) ?? Number.POSITIVE_INFINITY'),
    `${label} should put picks with tee times ahead of missing tee times`
  )
  assert.ok(
    source.includes('return pickNameSortValue(a).localeCompare(pickNameSortValue(b))'),
    `${label} should fall back to last-name alphabetical order before tee times are available`
  )
  assert.ok(
    source.includes("function outOfBoundsLabel(scoringIsLive: boolean, countScores: number)"),
    `${label} should label the underneath pick chips differently before live scoring`
  )
  assert.ok(
    source.includes("return scoringIsLive ? `Outside Top ${countScores}` : 'Other picks'"),
    `${label} should call pre-tournament overflow picks Other picks, not Outside Top`
  )
  assert.ok(
    source.includes('const showPreScoringWaiting = !') && source.includes('Picks hidden until lock'),
    `${label} should not label entries with submitted/hidden picks as plain Waiting`
  )
}

assert.ok(
  dashboard.includes('const pickScores = orderedPicks.map((name, index) => ({') && dashboard.includes('counted: index < countScores'),
  'dashboard pre-scoring entries should keep all submitted picks and mark only the main squares as counted'
)
assert.ok(
  dashboard.includes('entries.map(entry => buildPreScoringEntry(entry, countScores, entry.id !== currentEntryId && Boolean(entry.picks_hidden), preScoringPlayerByName))'),
  'dashboard should pass live field/tee-time data into pre-scoring pick ordering'
)
assert.ok(
  poolView.includes('visibleEntries.map(entry => buildPreScoringEntry(entry, pool.count_scores, preScoringPlayerByName))'),
  'pool page should pass live field/tee-time data into pre-scoring pick ordering'
)
assert.ok(
  poolView.includes('if (!selectedScoringIsLive || !groupedFormat || pickGroups.length === 0) return picks'),
  'pool page should not override pre-tournament last-name/tee-time ordering with grouped-pool order'
)

assert.ok(pickCardLayout.includes('export function pickGridColumnCount(count: number)'), 'pick-card column helper should be shared')
assert.ok(pickCardLayout.includes('if (count === 6) return 3'), 'six counted picks should render as 3 columns, producing two rows of three')
assert.ok(pickCardLayout.includes('if (count === 12) return 4'), 'twelve counted picks should render as four columns')
for (const [label, source] of [['dashboard', dashboard], ['pool page', poolView]]) {
  assert.ok(source.includes("import { pickGridColumnCount } from '@/lib/pick-card-layout'"), `${label} should use the shared pick-card column helper`)
  assert.ok(source.includes('style={{ gridTemplateColumns: `repeat(${pickGridColumns}, minmax(0, 1fr))` }}'), `${label} mobile pick cards should use dynamic grid columns`)
  assert.ok(source.includes('style={{ borderRightWidth: isEndOfGridRow ? 0 : undefined }}'), `${label} mobile pick cards should clear row-end borders using the dynamic column count`)
  assert.equal(source.includes('grid grid-cols-4 border-t border-[#d8cab0] bg-[#fbfbf5]'), false, `${label} mobile pick cards must not be hard-coded to 4 columns`)
}

console.log('pre-tournament pick-card display verified')
