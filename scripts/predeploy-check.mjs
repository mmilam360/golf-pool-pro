import { spawnSync } from 'node:child_process'

const checks = [
  ['npm', ['run', 'lint']],
  ['npm', ['run', 'test:final-result-announcements']],
  ['npm', ['run', 'test:pick-submission-validation']],
  ['npm', ['run', 'test:dashboard-edit-picks-cta']],
  ['npm', ['run', 'test:dashboard-pool-name-width']],
  ['npm', ['run', 'test:leverage-marker-info']],
  ['npm', ['run', 'test:dashboard-reorder-ui']],
  ['npm', ['run', 'test:dashboard-runner-player-parity']],
  ['npm', ['run', 'test:pre-tournament-pick-card-display']],
  ['npm', ['run', 'test:edit-picks-simplified-route']],
  ['npm', ['run', 'test:entry-saved-email-quota']],
  ['npm', ['run', 'test:transactional-email-headers']],
  ['npm', ['run', 'test:payment-due-reminder-email']],
  ['npm', ['run', 'test:reliability-hardening']],
  ['npm', ['run', 'test:live-scoring-health']],
  ['npm', ['run', 'test:live-tournament-replay']],
  ['npm', ['run', 'test:support-email-route']],
  ['npm', ['run', 'test:reminder-edit-links']],
  ['npm', ['run', 'test:runner-reminder-access']],
  ['npm', ['run', 'test:client-rls-hardening']],
  ['npm', ['run', 'test:pool-entry-details-editor']],
  ['npm', ['run', 'test:join-full-name-account-flow']],
  ['npm', ['run', 'test:full-name-reminder-account-fallback']],
  ['npm', ['run', 'test:guest-join-flow']],
  ['npm', ['run', 'test:entry-process-state']],
  ['npm', ['run', 'test:public-leaderboard-join-cta']],
  ['npm', ['run', 'test:public-leaderboard-states']],
  ['npm', ['run', 'test:run-it-back']],
  ['npm', ['run', 'test:grouped-auto-lock']],
  ['npm', ['run', 'test:pool-invites']],
  ['npm', ['run', 'test:pool-pricing']],
  ['npm', ['run', 'test:pool-fee-display']],
  ['npm', ['run', 'test:prod-audit-context']],
  ['npm', ['run', 'test:tournament-seo-copy']],
  ['npm', ['run', 'test:promo-exposure']],
  ['npm', ['run', 'test:golfer-status']],
  ['npm', ['run', 'test:round-leaderboards']],
  ['npm', ['run', 'build']],
]

for (const [command, args] of checks) {
  const label = `${command} ${args.join(' ')}`
  console.log(`\n==> ${label}`)
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false })
  if (result.status !== 0) {
    console.error(`\nFAILED: ${label}`)
    process.exit(result.status || 1)
  }
}

console.log('\nPredeploy checks passed. Next: deploy preview, run smoke checks, then promote/alias production.')
