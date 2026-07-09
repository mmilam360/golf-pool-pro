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
assert(poolView.includes('fixed inset-x-0 bottom-0'), 'Mobile save bar should float at the bottom of the viewport')
assert(poolView.includes('env(safe-area-inset-bottom)'), 'Mobile save bar should respect phone safe-area padding')
assert(poolView.includes('pb-28 sm:pb-0'), 'My Entry tab should reserve room for the mobile save bar')
assert(poolView.includes('savePicksHelperText'), 'Floating save controls should explain saved/unsaved/incomplete state')
assert(poolView.includes('disabled={savePicksDisabled}'), 'Floating save button should use the same save disabled rules')

console.log('Save-picks floating bar verified.')
