import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const markerSource = readFileSync('src/components/LeverageMarkers.tsx', 'utf8')
const scoringSource = readFileSync('src/lib/scoring.ts', 'utf8')

assert.ok(markerSource.includes('aria-label="How root for and root against are picked"'), 'legend should include an accessible info button')
assert.ok(markerSource.includes('className={detailsClassName}'), 'info should open inline without adding client state')
assert.ok(markerSource.includes('centerInfoBox') && markerSource.includes('left-1/2 top-[calc(100%+6px)]'), 'dashboard can center the info box under the legend')
assert.ok(markerSource.includes('function InfoIcon') && markerSource.includes('strokeLinecap="round"'), 'info trigger should use the standard curved info icon')
assert.ok(markerSource.includes('How this works'), 'popover should have a clear heading')
assert.ok(markerSource.includes('leverage algorithm'), 'popover should explain that the markers are algorithmic')
assert.ok(markerSource.includes('live standings') && markerSource.includes('every entry&apos;s picks'), 'popover should name the actual inputs')
assert.ok(markerSource.includes('scores can swing your rank the most'), 'popover should explain why golfers are flagged')
assert.ok(markerSource.includes('Root for:') && markerSource.includes('Root against:'), 'popover should explain both marker labels')
assert.ok(!markerSource.toLowerCase().includes('random'), 'popover should not frame the markers as random')
assert.ok(scoringSource.includes('buildHarePickMap') && scoringSource.includes('buildTortoisePickMap'), 'marker explanation should still match the scoring leverage maps')
assert.ok(scoringSource.includes('ownershipByPick(poolEntries)'), 'leverage maps should compare picks across entries')

console.log('leverage marker info verified')
