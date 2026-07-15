import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function expect(source, snippet, label) {
  if (!source.includes(snippet)) {
    throw new Error(`Missing ${label}`)
  }
}

const schemaMigration = read('supabase/migrations/20260713_01_require_pool_entry_email.sql')
const enforcementMigration = read('supabase/migrations/20260713_02_enforce_entry_identity_and_email.sql')
const databaseTypes = read('src/types/database.ts')
const createPagePath = fs.existsSync('src/app/(app)/pool/create/CreatePoolClient.tsx')
  ? 'src/app/(app)/pool/create/CreatePoolClient.tsx'
  : 'src/app/(app)/pool/create/page.tsx'
const createPage = read(createPagePath)
const joinPage = read('src/app/(app)/pool/join/page.tsx')
const poolView = read('src/app/(app)/pool/[id]/PoolView.tsx')
const inviteActions = read('src/app/(app)/pool-invites/actions.ts')
const guestRoute = read('src/app/api/pool/guest-entry/route.ts')
const accountRoute = read('src/app/api/pool/account-entry/route.ts')
const poolRoute = read('src/app/api/pools/[id]/route.ts')

expect(schemaMigration, 'add column if not exists require_entry_email boolean not null default false', 'pool email requirement column')
expect(schemaMigration, 'update public.gpp_entries e', 'confirmed-profile full-name backfill')
expect(schemaMigration, 'revoke execute on function public.gpp_create_guest_entry(text, text, text[], text) from public, anon, authenticated', 'legacy guest RPC revocation')
expect(enforcementMigration, 'gpp_enforce_entry_identity_and_email', 'database entry invariant trigger')
expect(databaseTypes, 'require_entry_email: boolean', 'database pool row type')
expect(databaseTypes, 'require_entry_email?: boolean', 'database pool write type')

expect(createPage, 'require_entry_email: requireEntryEmail', 'create-pool setting persistence')
expect(createPage, 'full_name: ownerFullName', 'owner entry full name')
expect(createPage, 'full_name_confirmed_at: profile.full_name_confirmed_at', 'owner entry full-name confirmation')
expect(createPage, 'Entrants will see that you require this for winner follow-up and settling the pool.', 'runner toggle purpose copy')

expect(joinPage, 'notificationEmail: entrantEmail || null', 'guest email submission')
expect(joinPage, 'notification_email: pool.require_entry_email ? signedInEmail : null', 'signed-in required email persistence')
expect(joinPage, 'Email required by pool runner', 'dynamic required-email label')
expect(joinPage, 'Golf Pools Pro will not use it for marketing.', 'required-email privacy copy')

expect(guestRoute, 'requireEntryEmail: Boolean(pool.require_entry_email)', 'guest lookup requirement response')
expect(guestRoute, "if (pool.require_entry_email && !notificationEmail) return badRequest('The pool runner requires a valid email.')", 'guest create enforcement')
expect(guestRoute, 'if (pool.require_entry_email && !effectiveNotificationEmail)', 'guest update enforcement')
expect(accountRoute, 'if (pool.require_entry_email)', 'account update enforcement')
expect(accountRoute, 'update.notification_email = accountEmail', 'account email repair')

expect(inviteActions, 'require_entry_email', 'invite pool requirement lookup')
expect(inviteActions, 'full_name: fullName', 'invite entry full name')
expect(inviteActions, 'full_name_confirmed_at: profile.full_name_confirmed_at', 'invite entry full-name confirmation')
expect(inviteActions, 'notification_email: requiredEmail || null', 'invite required email')

expect(poolView, "action: 'set-entry-email-requirement'", 'runner setting request')
expect(poolView, 'Email required by pool runner', 'existing guest required-email copy')
expect(poolView, "Want the leaderboard sent to you?", 'optional email copy')
expect(poolRoute, "if (action === 'set-entry-email-requirement')", 'owner-only email setting action')

console.log('Pool required-email and entry identity checks passed.')
