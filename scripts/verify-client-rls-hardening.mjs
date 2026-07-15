import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const migration = readFileSync('supabase/migrations/20260617_harden_client_rls_surface.sql', 'utf8')
const createPoolPath = existsSync('src/app/(app)/pool/create/CreatePoolClient.tsx')
  ? 'src/app/(app)/pool/create/CreatePoolClient.tsx'
  : 'src/app/(app)/pool/create/page.tsx'
const createPool = readFileSync(createPoolPath, 'utf8')

assert.ok(
  migration.includes('revoke insert, update, delete on table public.gpp_entries from anon;'),
  'anon clients should not be able to mutate entries directly'
)
assert.ok(
  migration.includes('revoke insert, update on table public.gpp_entries from authenticated;'),
  'authenticated entry mutations should be column-grant limited'
)
assert.ok(
  migration.includes('grant insert (pool_id, user_id, display_name, full_name, full_name_confirmed_at, notification_email, golfer_picks)'),
  'authenticated direct entry inserts should only grant player-facing columns'
)
assert.ok(
  migration.includes('grant update (display_name, full_name, full_name_confirmed_at, notification_email, golfer_picks)'),
  'authenticated direct entry updates should only grant player-facing columns'
)
assert.ok(
  migration.includes('drop policy if exists "Pool owner can admin entries" on public.gpp_entries;'),
  'pool owners should not have a direct client policy that bypasses server lock/remove checks'
)
assert.ok(
  migration.includes('Users can insert own entry before picks close')
    && migration.includes('Users can update own entry before picks close')
    && migration.includes("coalesce(t.status, '') not in ('live', 'completed')")
    && migration.includes('coalesce(p.is_locked, false) = false')
    && migration.includes('coalesce(p.is_completed, false) = false'),
  'entry insert/update RLS should enforce pool/tournament closed-state checks'
)
assert.ok(
  migration.includes('revoke insert, update, delete on table public.gpp_pools from anon;')
    && migration.includes('revoke insert, update, delete on table public.gpp_pools from authenticated;'),
  'browser clients should not have broad pool mutation privileges'
)
assert.ok(
  migration.includes('grant update (name) on table public.gpp_pools to authenticated;'),
  'direct pool updates should be limited to safe rename only'
)
assert.ok(
  migration.includes('payment_status = \'active\'')
    && migration.includes('paid_entry_limit = 5')
    && migration.includes('count_scores between 1 and pick_count')
    && migration.includes("coalesce(t.status, '') = 'upcoming'"),
  'direct pool creation policy should enforce safe initial pool state'
)
assert.ok(
  createPool.includes("fetch(`/api/pools/${data.id}`")
    && createPool.includes("method: 'DELETE'")
    && createPool.includes("confirm: 'DELETE'"),
  'create-pool cleanup should use the owner API delete route after direct pool DELETE grants are revoked'
)
assert.ok(
  !createPool.includes(".from('gpp_pools')\n          .delete()"),
  'create-pool cleanup should not depend on direct client gpp_pools delete privileges'
)

console.log('client RLS hardening verified')
