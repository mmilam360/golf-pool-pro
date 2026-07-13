import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dashboardPerformance = readFileSync('src/lib/dashboard-performance.ts', 'utf8')
const poolView = readFileSync('src/app/(app)/pool/[id]/PoolView.tsx', 'utf8')
const serviceWorkerRegister = readFileSync('src/components/ServiceWorkerRegister.tsx', 'utf8')
const leaderboardApi = readFileSync('src/app/api/tournaments/leaderboard/route.ts', 'utf8')
const proxy = readFileSync('src/proxy.ts', 'utf8')

assert.match(
  dashboardPerformance,
  /DASHBOARD_LIVE_SCORE_POLL_INTERVAL_MS\s*=\s*60 \* 1000/,
  'dashboard live-score polling should not exceed the once-per-minute tournament sync cadence'
)
assert.match(
  poolView,
  /document\.addEventListener\('visibilitychange', updateBrowserState\)/,
  'pool pages should track page visibility before polling live scores'
)
assert.match(
  poolView,
  /window\.addEventListener\('offline', updateBrowserState\)/,
  'pool pages should track offline state before polling live scores'
)
assert.match(
  poolView,
  /&& online\s+&& pageVisibilityState !== 'hidden'/,
  'pool live-score polling should stop in hidden or offline tabs'
)
assert.match(
  serviceWorkerRegister,
  /SERVICE_WORKER_UPDATE_CHECK_INTERVAL_MS\s*=\s*12 \* 60 \* 60 \* 1000/,
  'service worker update checks should be throttled instead of forced on every page load'
)
assert.match(
  serviceWorkerRegister,
  /if \(shouldCheckForServiceWorkerUpdate\(\)\) registration\.update\(\)/,
  'service worker register should only force update checks after the throttle allows it'
)
assert.match(
  leaderboardApi,
  /s-maxage=45, stale-while-revalidate=90/,
  'live leaderboard API should keep a short CDN cache window for many users watching the same tournament'
)
const proxyMatcherBlock = proxy.match(/matcher:\s*\[([\s\S]*?)\]/)?.[1] || ''

assert.doesNotMatch(
  proxyMatcherBlock,
  /['"]\/(?:['"]|,)|['"]\/login['"]|['"]\/signup['"]/,
  'public homepage/auth pages should not run through proxy middleware'
)
assert.match(
  proxyMatcherBlock,
  /\/dashboard\/:path\*|\/dashboard/,
  'protected dashboard routes should still run through proxy middleware'
)

console.log('Vercel request throttle contracts verified')
