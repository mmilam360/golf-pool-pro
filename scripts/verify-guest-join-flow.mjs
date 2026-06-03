import { readFileSync } from 'node:fs'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const migration = readFileSync('supabase/migrations/20260603_guest_join_flow.sql', 'utf8')
const joinPage = readFileSync('src/app/(app)/pool/join/page.tsx', 'utf8')
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

assert(joinPage.includes("type JoinStep = 'code' | 'name' | 'picks' | 'saved'"), 'join page must be a no-auth multi-step flow')
assert(joinPage.includes('Guest picks can’t be edited after saving.'), 'guest pick screen must explain one-time save')
assert(joinPage.includes('Pick 12 golfers to save') || joinPage.includes('Pick ${requiredPickCount} golfers to save'), 'save button must stay disabled until complete')
assert(joinPage.includes('Create account to link entry'), 'saved screen must offer account linking after picks are saved')
assert(joinPage.includes('Sign in to connect account'), 'join page must offer optional sign-in before saving picks')
assert(joinPage.includes('gpp_claim_guest_entry'), 'signed-in entrants must automatically link saved entries')
assert(joinPage.includes('quick My Entry view'), 'account CTA must mention quick My Entry view')
assert(joinPage.includes("/pool/${poolId}?tab=my-entry"), 'claim flow must land account users on My Entry')
assert(!joinPage.includes('/login?redirect=${encodeURIComponent(currentJoinRedirect())}'), 'join flow must not redirect to login before entry save')

const poolPage = readFileSync('src/app/(app)/pool/[id]/page.tsx', 'utf8')
const poolView = readFileSync('src/app/(app)/pool/[id]/PoolView.tsx', 'utf8')
assert(poolPage.includes("initialTab={requestedTab === 'my-entry' ? 'my-entry'"), 'pool page must pass safe tab deeplinks')
assert(poolView.includes('initialTab?: Tab'), 'PoolView must accept an initial tab')
assert(poolView.includes('initialHighlightedEntryId?: string | null'), 'PoolView must accept a public leaderboard entry highlight')

const proxy = readFileSync('src/proxy.ts', 'utf8')
assert(!proxy.includes("'/pool/join'"), 'guest join route must not be auth-protected')
assert(!proxy.includes("'/pool/join/:path*'"), 'proxy matcher must not force auth on guest join route')

assert(types.includes('user_id: string | null'), 'database types must allow null entry user_id')
assert(types.includes('guest_entry_token_hash'), 'database types must include guest entry token fields')

console.log('guest join flow verifier passed')
