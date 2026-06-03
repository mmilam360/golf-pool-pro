import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/app/(app)/pool/[id]/PoolView.tsx', 'utf8')

assert.ok(
  source.includes('!groupedFormat && (') && source.includes('{myPicks.length}/{pool.pick_count} picks'),
  'open-pick Tournament Field header should show current pick count'
)

assert.ok(
  source.includes("groupedFormat && (") && source.includes('{groupsNeedLock ? \'Preview only\' : `${myPicks.length}/${groupedTotalPicks} picks`}'),
  'grouped-pick count display should remain in the grouped header strip'
)

console.log('open-pick Tournament Field count verified')
