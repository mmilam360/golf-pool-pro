import { readFileSync } from 'node:fs'

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    process.exit(1)
  }
}

const poolView = readFileSync('src/app/(app)/pool/[id]/PoolView.tsx', 'utf8')
const myEntryTabStart = poolView.indexOf("{tab === 'my-entry'")
assert(myEntryTabStart >= 0, 'PoolView should render the My Entry tab')

const entryDetailsIndex = poolView.indexOf('{entryDetailsPanel}', myEntryTabStart)
const poolRulesIndex = poolView.indexOf('Pool rules', myEntryTabStart)
const mobileSaveIndex = poolView.indexOf('fixed left-4 right-4 top-[calc(env(safe-area-inset-top)+0.75rem)]', myEntryTabStart)

assert(poolView.includes('const showSavePicksControls ='), 'PoolView should gate floating save controls behind a shared boolean')
assert(poolView.includes('Pick slip'), 'Desktop save strip should label the selected picks area')
assert(poolView.includes('sticky top-3'), 'Desktop save strip should stay visible while scrolling picks')
assert(mobileSaveIndex >= 0, 'Mobile save box should be a standalone top-fixed box with iPhone safe-area clearance')
assert(poolView.includes('Save before leaving.'), 'Mobile save helper should be short enough to avoid truncation')
assert(!poolView.includes('Tap save before you leave this page.'), 'Mobile save helper should not use the old long copy')
assert(!poolView.includes('fixed inset-x-0 bottom-0'), 'Mobile save control should not be attached to the bottom of the viewport')
assert(!poolView.includes('pb-28 sm:pb-0'), 'My Entry tab should not add bottom blank space for the save control')
assert(!poolView.includes('pt-[5.25rem] sm:pt-0'), 'My Entry tab should not reserve a blank top spacer for the floating save control')
assert(poolView.includes('scroll-mt-[7rem]'), 'Edit-picks scroll target should clear the top floating save box without adding real blank space')
assert(poolView.includes('const golferListScrollClass = showSavePicksControls'), 'Golfer list should switch to a viewport-sized mobile scroll area when the save box is showing')
assert(poolView.includes('max-h-[calc(100svh-17rem)] sm:max-h-[28rem]'), 'Mobile golfer list should fit below the top save box instead of forcing page-level blank scroll')
assert(poolView.includes('const poolPickRuleSummary ='), 'Pick-entry page should compute a compact pool-specific rules summary')
assert(poolView.includes('const obRuleSummary ='), 'Pick-entry page should compute a compact OB rules summary')
assert(poolView.includes('OB active · +'), 'OB summary should expose active OB penalty compactly')
assert(poolView.includes('aria-label="How OB works"'), 'OB explanation should live behind a small info control')
assert(!poolView.includes('>Make picks</p>'), 'Old Make Picks header should be replaced by the compact Pool rules strip')
assert(entryDetailsIndex >= 0, 'Entry details panel should render in the My Entry tab')
assert(poolRulesIndex >= 0, 'Compact Pool rules strip should render in the My Entry tab')
assert(entryDetailsIndex < poolRulesIndex, 'Entry details should appear before the Pool rules strip when editing picks')
assert(poolRulesIndex < mobileSaveIndex, 'Floating mobile save box should stay separate from the rules strip')
assert(poolView.includes('sm:inline-flex'), 'The in-card save button should be desktop-only because mobile uses the floater')
assert(poolView.includes('disabled={savePicksDisabled}'), 'Floating save button should use the same save disabled rules')

console.log('Save-picks floating box and rules strip verified.')
