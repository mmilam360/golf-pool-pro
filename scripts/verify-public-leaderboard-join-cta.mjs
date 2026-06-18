import { readFileSync } from 'node:fs'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const publicLeaderboard = readFileSync('src/app/leaderboard/[id]/page.tsx', 'utf8')
const joinPage = readFileSync('src/app/(app)/pool/join/page.tsx', 'utf8')
const guestEntryRoute = readFileSync('src/app/api/pool/guest-entry/route.ts', 'utf8')
const managePools = readFileSync('src/app/(app)/manage-pools/page.tsx', 'utf8')

assert(publicLeaderboard.includes('preLockJoinOpen'), 'public leaderboard must compute pre-lock join state')
assert(publicLeaderboard.includes('Trying to join this pool?'), 'public leaderboard must show the pre-lock join prompt')
assert(publicLeaderboard.includes('Join pool'), 'public leaderboard must have a Join pool action')
assert(publicLeaderboard.includes('`/pool/join?pool=${encodeURIComponent(pool.id)}`'), 'public join action must use pool id, not expose the passcode in the public URL')
assert(publicLeaderboard.includes('{!preLockJoinOpen && ('), 'generic create-pool CTA should move below the board after lock/live')
assert(publicLeaderboard.includes('Sign in'), 'public leaderboard should offer account sign-in')

assert(guestEntryRoute.includes("url.searchParams.get('poolId')"), 'guest-entry lookup must support pool id from public leaderboard joins')
assert(guestEntryRoute.includes('if (lookupByPoolId && picksClosed)'), 'pool-id lookup must stop once picks are closed')
assert(guestEntryRoute.includes('passcode: pool.passcode'), 'pool-id lookup must return the passcode to the join form without showing it on the public leaderboard URL')

assert(joinPage.includes("params.get('pool')"), 'join page must accept pool-id links')
assert(joinPage.includes('showPasscodeInput = !directPoolLink'), 'join page must hide passcode boxes for direct pool links')
assert(joinPage.includes('directPoolName'), 'join page should show pool context instead of the code for direct pool links')

assert(managePools.includes('primaryHref = showInvitePrep ? `/pool/${pool.id}` : `/pool/${pool.id}?tab=leaderboard`'), 'Manage Pools current cards should open the true top/invite area before lock and leaderboard after lock')
assert(managePools.includes('Open invite board →'), 'Manage Pools should label the pre-lock top action as invite board')
assert(managePools.includes('Pool settings →'), 'Manage Pools should keep a separate settings path')

console.log('public leaderboard join CTA verified')
