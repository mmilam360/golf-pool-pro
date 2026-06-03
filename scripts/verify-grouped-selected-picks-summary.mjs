import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/app/(app)/pool/[id]/PoolView.tsx', 'utf8')

assert.ok(
  !source.includes("{group.players.map(player => (\n                                    <span key={player.id || player.name} className=\"text-sm font-semibold text-stone-600\">") ,
  'grouped selected-picks summary must not list every available player in empty groups'
)
assert.ok(
  source.includes('No pick from this group yet.'),
  'grouped selected-picks summary should show an empty-group placeholder instead'
)

console.log('grouped selected-picks summary verified')
