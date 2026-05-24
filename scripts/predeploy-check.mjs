import { spawnSync } from 'node:child_process'

const checks = [
  ['npm', ['run', 'lint']],
  ['npm', ['run', 'test:final-result-announcements']],
  ['npm', ['run', 'test:run-it-back']],
  ['npm', ['run', 'test:grouped-auto-lock']],
  ['npm', ['run', 'test:pool-invites']],
  ['npm', ['run', 'test:pool-pricing']],
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
