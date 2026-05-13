import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const scoringSource = readFileSync(new URL('../src/lib/scoring.ts', import.meta.url), 'utf8')
const poolViewSource = readFileSync(new URL('../src/app/(app)/pool/[id]/PoolView.tsx', import.meta.url), 'utf8')
const poolPageSource = readFileSync(new URL('../src/app/(app)/pool/[id]/page.tsx', import.meta.url), 'utf8')
const landingSource = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8')
const layoutSource = readFileSync(new URL('../src/app/layout.tsx', import.meta.url), 'utf8')

assert.match(scoringSource, /status !== 'active'/, 'OB stand-ins should include cut, WD, DNQ, and missing/non-active picks')
assert.doesNotMatch(scoringSource, /status === 'cut'/, 'OB stand-ins should not be limited to missed-cut players')
assert.match(poolViewSource, /const canSeeAllEntries = picksAreClosed/, 'Owner should not see everyone else before lock/start')
assert.match(poolViewSource, /visibleEntries/, 'PoolView should render a filtered entry list before lock/start')
assert.match(poolPageSource, /const picksAreVisible = pool\.is_locked \|\| scoringIsLive/, 'Server pool page should hide entries from everyone, including owner, before lock/start')
assert.match(poolPageSource, /eq\('user_id', user\.id\)/, 'Server pool page should filter entrant data to current user before lock/start')
assert.match(poolViewSource, /buildPreScoringEntry/, 'PoolView should build pre-scoring own-picks rows')
assert.match(poolViewSource, /localeCompare/, 'Pre-scoring picks should be alphabetical before top-counting display')
assert.match(landingSource, /-mb-10/, 'Landing leaderboard post should overlap the next section enough to remove the gap')
assert.match(landingSource, /-mt-10/, 'Next green section should start behind the post so no paper gap shows')
assert.match(layoutSource, /favicon\.svg\?v=3/, 'Favicon should prefer the cache-busted SVG GPP tab icon')

console.log('scoring/visibility/landing/favicon rule markers present')
