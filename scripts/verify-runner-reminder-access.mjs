import { readFileSync } from 'node:fs'

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    process.exit(1)
  }
}

const managePools = readFileSync('src/app/(app)/manage-pools/page.tsx', 'utf8')
const poolView = readFileSync('src/app/(app)/pool/[id]/PoolView.tsx', 'utf8')
const layout = readFileSync('src/app/(app)/layout.tsx', 'utf8')
const reminderGrace = readFileSync('src/lib/incomplete-picks-reminder.ts', 'utf8')
const button = readFileSync('src/components/RunnerMissingPicksEmailButton.tsx', 'utf8')

assert(managePools.includes("RunnerMissingPicksEmailButton"), 'Manage Pools should expose a direct missing-picks email button')
assert(managePools.includes("#pick-reminders"), 'Manage Pools should link to the detailed Pick reminders section')
assert(managePools.includes("totalPicksRequired(pool)"), 'Manage Pools should use the shared required-pick count helper')
assert(managePools.includes("Picks in"), 'Current pool card should show pick completion at a glance')

assert(poolView.includes('id="pick-reminders"'), 'Pool Settings Pick reminders section should have a stable deep-link anchor')
assert(poolView.includes("window.location.hash === '#pick-reminders'"), 'Pool Settings route should scroll to Pick reminders when deep-linked')
assert(poolView.includes("fetch('/api/pools/missing-picks-reminder'"), 'Pool Settings should keep the reminder send action')

assert(layout.includes("totalPicksRequired(pool)"), 'Dashboard popup should use shared required-pick count helper')
assert(layout.includes("group_count, picks_per_group, pick_groups_json"), 'Dashboard popup query should fetch grouped-pool pick-count fields')
assert(layout.includes("created_at, gpp_tournaments(status)"), 'Dashboard popup query should fetch pool creation time')
assert(layout.includes("poolIsPastMissingPicksReminderGracePeriod(pool.created_at"), 'Dashboard popup should suppress new pools during the grace period')
assert(reminderGrace.includes('MISSING_PICKS_REMINDER_GRACE_HOURS = 12'), 'Missing-picks popup grace period should be 12 hours')

assert(button.includes("fetch('/api/pools/missing-picks-reminder'"), 'Runner email button should call the owner-only reminder endpoint')
assert(button.includes("already got one today"), 'Runner email button should surface daily duplicate status')

console.log('Runner missing-picks reminder access verified.')
