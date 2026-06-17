import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const poolView = readFileSync('src/app/(app)/pool/[id]/PoolView.tsx', 'utf8')
const dashboardActivePools = readFileSync('src/components/DashboardActivePools.tsx', 'utf8')
const mobileInstallPrompt = readFileSync('src/components/MobileInstallPrompt.tsx', 'utf8')
const tournamentSync = readFileSync('src/lib/tournament-sync.ts', 'utf8')
const poolEntriesRoute = readFileSync('src/app/api/pools/[id]/entries/route.ts', 'utf8')

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
assert.ok(
  mobileInstallPrompt.includes("const [hash, setHash] = useState('')"),
  'mobile install prompt should track URL hash so edit-picks routes can opt out'
)
assert.ok(
  mobileInstallPrompt.includes("const editPicksRoute = /^\\/pool\\/[^/]+$/.test(pathname) && hash === '#make-picks'"),
  'mobile install prompt should identify pool edit-picks routes'
)
assert.ok(
  mobileInstallPrompt.includes("const shouldOfferInstall = !editPicksRoute && (pathname === '/dashboard' || /^\\/pool\\/[^/]+$/.test(pathname))"),
  'mobile install prompt should stay hidden on the edit-picks route while remaining available on dashboard and normal pool pages'
)
assert.ok(
  poolView.includes("const canLeaveOwnEntry = !guestMode && Boolean(myEntry) && !isOwner"),
  'Leave pool visibility should depend on signed-in non-owner entry identity; server route enforces lock/live/completed eligibility'
)
assert.ok(
  poolView.includes('{canLeaveOwnEntry && ('),
  'edit-only route should render Leave pool from the dedicated eligibility flag'
)
assert.ok(
  poolView.includes('Leave this pool') && poolView.includes('onClick={() => setRemoveTarget(myEntry.id)}'),
  'Leave pool should use a plain React button that opens the confirmation modal'
)
assert.ok(
  !poolView.includes('<summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left text-xs font-black uppercase tracking-[0.12em] text-[#b21e23]'),
  'Leave pool should not be hidden behind the previous nested details/summary control'
)
assert.ok(
  poolView.includes("body: JSON.stringify(leavingOwnEntry ? { action: 'leave', entryId } : { entryId, removedReason: removeReason })"),
  'Leave pool should call the self-leave action instead of the owner-only remove route body'
)
assert.ok(
  poolView.includes("setMyEntry(null)") && poolView.includes("setMyPicks([])"),
  'successful Leave pool should clear the current entrant state in the edit route'
)
assert.ok(
  poolView.includes("{removingOwnEntry ? 'Leave pool' : 'Remove entry'}"),
  'Leave pool confirmation should use player-facing copy instead of owner removal copy'
)
assert.ok(
  poolEntriesRoute.includes("if (action === 'leave')") && poolEntriesRoute.includes(".eq('user_id', user.id)"),
  'entries API should let non-owner users remove only their own entry when leaving a pool'
)
assert.ok(
  poolEntriesRoute.indexOf("if (action === 'leave')") < poolEntriesRoute.lastIndexOf("if (pool.owner_id !== user.id)"),
  'self-leave route must run before the PATCH owner-only removal guard'
)

console.log('edit-picks simplified route verified')
