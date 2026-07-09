import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { buildOpenChampionshipPoolRunnerEmail } from '../src/lib/marketing-emails.ts'

const email = buildOpenChampionshipPoolRunnerEmail({
  origin: 'https://www.golfpoolspro.com',
  recipientName: 'Michael',
  tournamentStartLabel: 'July 16',
  unsubscribeUrl: 'https://www.golfpoolspro.com/unsubscribe/example-token',
})

assert.equal(email.subject, 'Run an Open pool for your group')
assert.equal(email.preheader, "This is about starting your own Open Championship pool, not joining someone else's.")
assert.match(email.text, /running a new Open Championship pool for your group/i)
assert.match(email.text, /It is not an invite to join someone else's pool/i)
assert.match(email.text, /Players pick on their phones/i)
assert.match(email.text, /leaderboard updates during the tournament/i)
assert.match(email.text, /Rooting interests are clear/i)
assert.match(email.text, /First 5 active entries are free/i)
assert.match(email.text, /Create your Open pool: https:\/\/www\.golfpoolspro\.com\/pool\/create\?tournament=The%20Open&start=2026-07-16/)
assert.match(email.text, /Unsubscribe: https:\/\/www\.golfpoolspro\.com\/unsubscribe\/example-token/)

assert.match(email.html, /Run a new Open pool/)
assert.match(email.html, /Why run it here/)
assert.match(email.html, /Players pick on their phones/)
assert.match(email.html, /A live board all week/)
assert.match(email.html, /Rooting interests are obvious/)
assert.match(email.html, /Create your Open pool/)
assert.match(email.html, /Unsubscribe/)
assert.doesNotMatch(email.html, /Finish picks|Picks still needed|Add full name|Quick ask|payment due/i)
assert.doesNotMatch(email.text, /Finish picks|Picks still needed|Add full name|Quick ask|payment due/i)
assert.doesNotMatch(email.subject, /join|sign up/i)

const forbidden = /buy-in|payout|purse|cash|wager|betting/i
assert.equal(forbidden.test(email.text), false, 'marketing email avoids wagering/cash-pool language')
assert.equal(forbidden.test(email.html), false, 'marketing email html avoids wagering/cash-pool language')

writeFileSync('/tmp/gpp-open-runner-email-preview.html', email.html)
console.log('open runner marketing email verified')
console.log('preview: /tmp/gpp-open-runner-email-preview.html')
