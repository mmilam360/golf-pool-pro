import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const scoringSource = readFileSync(new URL('../src/lib/scoring.ts', import.meta.url), 'utf8')
const poolViewSource = readFileSync(new URL('../src/app/(app)/pool/[id]/PoolView.tsx', import.meta.url), 'utf8')
const poolPageSource = readFileSync(new URL('../src/app/(app)/pool/[id]/page.tsx', import.meta.url), 'utf8')
const landingSource = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8')

assert.match(scoringSource, /cut/i, 'scoring should explicitly handle cut players for OB')
assert.match(scoringSource, /status === 'cut'/, 'OB stand-ins should be limited to cut players')
assert.match(poolViewSource, /canSeeAllEntries/, 'PoolView should compute entry visibility')
assert.match(poolViewSource, /visibleEntries/, 'PoolView should render a filtered entry list before lock/start')
assert.match(poolPageSource, /picksAreVisible/, 'Server pool page should not pass hidden entries before lock/start')
assert.match(poolPageSource, /eq\('user_id', user\.id\)/, 'Server pool page should filter entrant data to current user before lock/start')
assert.match(poolViewSource, /buildPreScoringEntry/, 'PoolView should build pre-scoring own-picks rows')
assert.match(poolViewSource, /localeCompare/, 'Pre-scoring picks should be alphabetical before top-counting display')
assert.match(landingSource, /-mb-3/, 'Landing leaderboard post should overlap the next section enough to remove the gap')

console.log('scoring/visibility rule markers present')
