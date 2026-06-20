import assert from 'node:assert/strict'
import { buildPaymentDueReminderEmail } from '../src/lib/pool-transactional-emails.ts'

const email = buildPaymentDueReminderEmail({
  origin: 'https://www.golfpoolspro.com',
  poolId: 'pool-123',
  poolName: '2026 Northern Ohio PGA U.S. Open Pool',
  tournamentName: 'U.S. Open',
  runnerName: 'Danielle',
  activeEntryCount: 87,
  amountDueLabel: '$20',
  dueDateLabel: 'Saturday, Jun 20',
})

assert.equal(email.subject, 'Quick reminder: pool fee due today for 2026 Northern Ohio PGA U.S. Open Pool')
assert.match(email.text, /Danielle, your pool fee is due today\./)
assert.match(email.text, /Due date: Saturday, Jun 20/)
assert.match(email.text, /Please pay today to keep the live leaderboard visible/)
assert.match(email.text, /Otherwise, we'll temporarily hide the leaderboard until the pool fee is paid/)
assert.match(email.text, /Entries and picks are safe/)
assert.match(email.text, /Active entries: 87/)
assert.match(email.text, /Amount due: \$20/)
assert.match(email.text, /https:\/\/www\.golfpoolspro\.com\/pool\/pool-123\?tab=pool-settings/)
assert.match(email.html, /Pay pool fee/)

const forbidden = /buy-in|payout|purse|cash|wager|betting/i
assert.equal(forbidden.test(email.text), false, 'payment reminder avoids wagering/cash-pool language')
assert.equal(forbidden.test(email.html), false, 'payment reminder html avoids wagering/cash-pool language')

console.log('payment due reminder email verified')
