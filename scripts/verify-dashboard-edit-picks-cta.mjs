import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/DashboardActivePools.tsx', 'utf8')

assert.ok(
  source.includes('function OpenPicksBar({ pool, tournament, mode, entry }'),
  'dashboard OpenPicksBar must receive the current entry so it can choose Make picks vs Edit picks'
)

assert.ok(
  !source.includes("if (mode === 'player') return null"),
  'player dashboard must not hide the open-picks CTA'
)

assert.ok(
  source.includes("picked > 0 ? 'Edit picks' : 'Make picks'"),
  'player dashboard should show Edit picks when saved picks exist and Make picks before picks exist'
)

assert.ok(
  source.includes("groupedPending ? 'View groups'"),
  'grouped pools waiting for group lock should use View groups instead of promising editable picks'
)

assert.ok(
  source.includes('<span className="min-w-0 whitespace-nowrap text-[#657168]"><span className="text-[#123c2f]">{picked}/{needed}</span> picks</span>'),
  'dashboard CTA should show pick progress next to the edit action'
)

const openPicksBarCalls = source.match(/<OpenPicksBar[^>]+>/g) || []
assert.ok(openPicksBarCalls.length >= 2, 'dashboard should render OpenPicksBar in empty and normal leaderboard states')
for (const call of openPicksBarCalls) {
  assert.ok(
    call.includes('entry={currentEntryRecord}'),
    `OpenPicksBar call must pass currentEntryRecord: ${call}`
  )
}

assert.ok(
  source.includes('href = mode === \'runner\' ? `/pool/${pool.id}?tab=pool-settings` : `/pool/${pool.id}#make-picks`'),
  'player dashboard edit CTA should link to the pool pick editor anchor'
)

console.log('dashboard edit-picks CTA verified')
