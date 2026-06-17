import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const poolView = readFileSync('src/app/(app)/pool/[id]/PoolView.tsx', 'utf8')
const dashboardActivePools = readFileSync('src/components/DashboardActivePools.tsx', 'utf8')
const tournamentSync = readFileSync('src/lib/tournament-sync.ts', 'utf8')

assert.ok(
  dashboardActivePools.includes("`/pool/${pool.id}#make-picks`"),
  'player dashboard edit-picks CTA should keep linking to the #make-picks route'
)
assert.ok(
  tournamentSync.includes('url: `/pool/${params.poolId}#make-picks`'),
  'field-update alerts should keep sending entrants to the #make-picks route'
)
assert.ok(
  poolView.includes('const [entryEditOnly, setEntryEditOnly] = useState(false)'),
  'PoolView should track the edit-only route state'
)
assert.ok(
  poolView.includes("const editPicksRoute = !settingsRequested && !publicView && window.location.hash === '#make-picks'"),
  'PoolView should detect #make-picks as the edit-only entry route while preserving owner settings'
)
assert.ok(
  poolView.includes('setEntryEditOnly(editPicksRoute)'),
  'PoolView should update edit-only state from the current route'
)
assert.ok(
  poolView.includes('window.addEventListener(\'hashchange\', applyRouteState)'),
  'PoolView should handle same-page hash changes into the edit-only route'
)
assert.ok(
  poolView.includes('if (!guestEntryToken && !entryEditOnly) setTab(\'leaderboard\')'),
  'saving picks from the edit-only route should not bounce the player back to the leaderboard tab'
)
assert.ok(
  poolView.includes('{!entryEditOnly && !publicView && !guestMode && ('),
  'edit-only route should hide the leaderboard/my-entry/settings tab switcher'
)
assert.ok(
  poolView.includes('{!entryEditOnly && !publicView && canInvitePlayers && ('),
  'edit-only route should hide runner invite prep above the picker'
)
assert.ok(
  poolView.includes('{!publicView && !entryEditOnly && !scoringIsLive && <div'),
  'edit-only route should hide the compact pool status/action row above the picker'
)
assert.ok(
  poolView.includes('{!entryEditOnly && !publicView && isOwner && groupedFormat && !groupsFinalized && ('),
  'edit-only route should hide owner group-lock admin prompt'
)
assert.ok(
  poolView.includes("{!entryEditOnly && isOwner && paymentStatus !== 'active' && ("),
  'edit-only route should hide owner payment prompt'
)
assert.ok(
  poolView.includes('{entryDetailsPanel}') && poolView.indexOf('{entryDetailsPanel}') < poolView.indexOf('{showSelectedPicks && ('),
  'edit-only route should still show entry details before the picks editor'
)
assert.ok(
  poolView.includes('{tab === \'leaderboard\' && ('),
  'normal leaderboard tab should still exist for the regular pool page'
)
assert.ok(
  poolView.includes("if (settingsRequested) {\n        setTab('pool-settings')"),
  'owner pool-settings route should still take precedence over #make-picks'
)

console.log('edit-picks simplified route verified')
