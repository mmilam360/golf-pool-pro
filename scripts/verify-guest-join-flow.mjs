import { existsSync, readFileSync } from 'node:fs'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const migration = readFileSync('supabase/migrations/20260603_guest_join_flow.sql', 'utf8')
const joinPage = readFileSync('src/app/(app)/pool/join/page.tsx', 'utf8')
const guestEntryRoute = readFileSync('src/app/api/pool/guest-entry/route.ts', 'utf8')
const accountEntryRoute = readFileSync('src/app/api/pool/account-entry/route.ts', 'utf8')
const poolEntriesRoute = readFileSync('src/app/api/pools/[id]/entries/route.ts', 'utf8')
const types = readFileSync('src/types/database.ts', 'utf8')

assert(migration.includes('alter column user_id drop not null'), 'guest migration must allow entries without a user_id')
assert(migration.includes('guest_entry_token_hash'), 'guest migration must add a private guest entry token hash')
assert(migration.includes('gpp_guest_join_payload'), 'guest migration must expose a safe passcode lookup RPC')
assert(migration.includes('gpp_create_guest_entry'), 'guest migration must expose a safe guest entry save RPC')
assert(migration.includes('gpp_claim_guest_entry'), 'guest migration must expose a post-auth claim RPC')
assert(migration.includes('coalesce(array_length(p_golfer_picks, 1), 0) <> v_pool.pick_count'), 'standard guest entries must be complete before saving')
assert(migration.includes('coalesce(array_length(p_golfer_picks, 1), 0) <> v_required_picks'), 'grouped guest entries must be complete before saving')
assert(migration.includes('duplicate golfers'), 'guest save must reject duplicate picks')
assert(migration.includes("jsonb_array_elements(coalesce(v_tournament.field_json, '[]'::jsonb))"), 'standard guest save must validate picks against the tournament field')
assert(migration.includes("jsonb_array_elements(coalesce(to_jsonb(v_pool)->'pick_groups_json', '[]'::jsonb))"), 'grouped guest save must validate picks against locked groups')
assert(migration.includes('selected.pick_count <>'), 'grouped guest save must enforce picks per locked group')

assert(joinPage.includes("params.get('pool')"), 'join page must accept public leaderboard pool-id links')
assert(joinPage.includes('showPasscodeInput = !directPoolLink'), 'join page must hide passcode boxes for direct public-board links')
assert(joinPage.includes('directPoolName'), 'join page should show pool context for direct public-board links')
assert(joinPage.includes('Full name'), 'join page must collect pool-runner full name')
assert(joinPage.includes('Leaderboard name'), 'join page must collect leaderboard name')
assert(joinPage.includes('Only the pool runner sees this.'), 'join page must explain full-name privacy')
assert(joinPage.includes('Account sign in'), 'join page must offer optional sign-in')
assert(joinPage.includes('Make Picks'), 'join page must land entrants in the pick-making flow')
assert(joinPage.includes("fetch('/api/pool/guest-entry'"), 'guest join must create an entry without requiring auth')
assert(joinPage.includes('entryProcessIsClosed(pool, tournament)'), 'signed-in join must use shared entry-closed state')
assert(joinPage.includes("/pool/${data.poolId}?guest=${encodeURIComponent(data.token)}"), 'guest join must return to pool with guest token')
assert(joinPage.includes('DUPLICATE_ENTRY_NAME_MESSAGE'), 'signed-in join must show duplicate-entry-name copy')

for (const [label, source] of [
  ['guest entry route', guestEntryRoute],
  ['account entry route', accountEntryRoute],
  ['pool entries route', poolEntriesRoute],
]) {
  assert(source.includes('entryProcessIsClosed'), `${label} must use shared entry-closed state`)
  assert(source.includes('leaderboard_json'), `${label} must fetch leaderboard rows so status downgrades cannot reopen entries`)
  assert(source.includes('results_finalized_at'), `${label} must fetch finalized-result state so final pools stay closed`)
}

const poolPage = readFileSync('src/app/(app)/pool/[id]/page.tsx', 'utf8')
const poolView = readFileSync('src/app/(app)/pool/[id]/PoolView.tsx', 'utf8')
assert(poolPage.includes('guestEntryToken={usingGuestToken ? guestToken : \'\'}'), 'pool page must pass guest tokens into PoolView')
assert(poolView.includes("guestMode ? 'my-entry'"), 'guest users must land on My Entry after joining')
assert(poolView.includes("new URLSearchParams(window.location.search).get('tab')"), 'PoolView must own safe tab route state')
assert(poolView.includes('type Tab'), 'PoolView must keep explicit tab states')
assert(poolView.includes('initialHighlightedEntryId?: string | null'), 'PoolView must accept a public leaderboard entry highlight')

if (existsSync('src/proxy.ts')) {
  const proxy = readFileSync('src/proxy.ts', 'utf8')
  assert(!proxy.includes("'/pool/join'"), 'guest join route must not be auth-protected')
  assert(!proxy.includes("'/pool/join/:path*'"), 'proxy matcher must not force auth on guest join route')
}

assert(types.includes('user_id: string | null'), 'database types must allow null entry user_id')
assert(types.includes('guest_entry_token_hash'), 'database types must include guest entry token fields')

console.log('guest join flow verifier passed')
