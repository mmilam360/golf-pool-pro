import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const accountSource = readFileSync('src/components/AccountClient.tsx', 'utf8')
const posterSource = readFileSync('src/app/(app)/pool/[id]/poster/PoolPosterClient.tsx', 'utf8')
const poolViewSource = readFileSync('src/app/(app)/pool/[id]/PoolView.tsx', 'utf8')
const tournamentLeaderboardSource = readFileSync('src/components/TournamentLeaderboard.tsx', 'utf8')

assert.ok(
  accountSource.includes("role={tone === 'error' ? 'alert' : 'status'}") &&
    accountSource.includes("aria-live={tone === 'error' ? 'assertive' : 'polite'}") &&
    accountSource.includes('aria-atomic="true"'),
  'account feedback should announce errors immediately and other updates politely',
)

assert.ok(
  posterSource.includes("role={exportStatus.startsWith('Download failed') ? 'alert' : 'status'}") &&
    posterSource.includes("aria-live={exportStatus.startsWith('Download failed') ? 'assertive' : 'polite'}") &&
    posterSource.includes('aria-atomic="true"'),
  'poster export feedback should announce failures and successful exports',
)
assert.ok(
  posterSource.includes('placeholder="Host instructions, if needed"'),
  'poster custom-note placeholder should use neutral host-owned copy',
)
assert.ok(
  !posterSource.includes('Pay Michael cash') && !posterSource.includes('Venmo @michaelmay') && !posterSource.includes('PayPal @michaelmay'),
  'poster source should not ship personal payment handles',
)

assert.match(poolViewSource, /<th scope="col"[^>]*>Rank<\/th>/, 'pool leaderboard rank header should have column scope')
assert.match(poolViewSource, /<th scope="col"[^>]*>Entry<\/th>/, 'pool leaderboard entry header should have column scope')
assert.match(poolViewSource, /<th scope="colgroup"[^>]*colSpan=\{pool\.count_scores\}[^>]*>Top \{pool\.count_scores\} golfers<\/th>/, 'pool leaderboard golfer group should have column-group scope')
assert.match(poolViewSource, /<th scope="col"[^>]*>Total<\/th>/, 'pool leaderboard total header should have column scope')

assert.equal(
  (tournamentLeaderboardSource.match(/<th scope="col"/g) || []).length,
  5,
  'tournament leaderboard should scope all five column headers',
)

console.log('accessibility audit fixes verified')
