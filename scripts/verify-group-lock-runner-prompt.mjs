import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const poolView = readFileSync(new URL('../src/app/(app)/pool/[id]/PoolView.tsx', import.meta.url), 'utf8')

assert.ok(
  poolView.includes('const showGroupLockRunnerPrompt = Boolean(isOwner && !entryEditOnly && !publicView && groupsNeedLock)'),
  'floating lock control must only appear for the pool runner while grouped pools need locking'
)
assert.ok(poolView.includes('{/* Floating grouped-pool runner action */}'))
assert.ok(poolView.includes('{showGroupLockRunnerPrompt && ('))
assert.ok(poolView.includes('className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-4 right-4 z-40'))
assert.ok(poolView.includes('aria-labelledby="group-lock-runner-title"'))
assert.match(poolView, /id="group-lock-runner-title"[^>]*>Lock groups to open picks</)
assert.ok(poolView.includes('Players cannot make picks until you lock the groups.'))
assert.ok(poolView.includes("{finalizingGroups ? 'Locking...' : 'Lock groups'}"))
assert.equal(
  (poolView.match(/onClick=\{finalizeGroups\}/g) || []).length,
  1,
  'the existing finalizeGroups action should have one visible trigger'
)
assert.ok(
  !poolView.includes('Groups are not locked yet.'),
  'the old inline runner banner must be removed instead of duplicating the action'
)

console.log('group lock runner prompt verified')
