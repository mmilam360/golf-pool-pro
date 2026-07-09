import { readFileSync } from 'node:fs'

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    process.exit(1)
  }
}

const poolView = readFileSync('src/app/(app)/pool/[id]/PoolView.tsx', 'utf8')

assert(poolView.includes('const showSavePicksControls ='), 'PoolView should gate floating save controls behind a shared boolean')
assert(poolView.includes('Pick slip'), 'Desktop save strip should label the selected picks area')
assert(poolView.includes('sticky top-3'), 'Desktop save strip should stay visible while scrolling picks')
assert(poolView.includes('fixed left-4 right-4 top-[calc(env(safe-area-inset-top)+0.75rem)]'), 'Mobile save box should be a standalone top-fixed box with iPhone safe-area clearance')
assert(poolView.includes("pt-[5.25rem] sm:pt-0"), 'My Entry section should reserve top space on mobile so the fixed save box does not cover the pick area')
assert(!poolView.includes('fixed inset-x-0 bottom-0'), 'Mobile save control should not be attached to the bottom of the viewport')
assert(!poolView.includes('pb-28 sm:pb-0'), 'My Entry tab should not add bottom blank space for the save control')
assert(poolView.includes('const golferListScrollClass = showSavePicksControls'), 'Golfer list should switch to a viewport-sized mobile scroll area when the save box is showing')
assert(poolView.includes('max-h-[calc(100svh-17rem)] sm:max-h-[28rem]'), 'Mobile golfer list should fit below the top save box instead of forcing page-level blank scroll')
assert(poolView.includes('savePicksHelperText'), 'Floating save controls should explain saved/unsaved/incomplete state')
assert(poolView.includes('disabled={savePicksDisabled}'), 'Floating save button should use the same save disabled rules')

console.log('Save-picks floating bar verified.')
