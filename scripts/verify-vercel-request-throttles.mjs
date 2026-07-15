import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const dashboardPerformance = readFileSync('src/lib/dashboard-performance.ts', 'utf8')
const dashboardActivePools = readFileSync('src/components/DashboardActivePools.tsx', 'utf8')
const poolView = readFileSync('src/app/(app)/pool/[id]/PoolView.tsx', 'utf8')
const serviceWorkerRegister = readFileSync('src/components/ServiceWorkerRegister.tsx', 'utf8')
const leaderboardApi = readFileSync('src/app/api/tournaments/leaderboard/route.ts', 'utf8')

assert.match(
  dashboardPerformance,
  /DASHBOARD_LIVE_SCORE_POLL_INTERVAL_MS\s*=\s*5 \* 60 \* 1000/,
  'dashboard live-score polling should be slower than pool pages because it is not the primary live board'
)
assert.doesNotMatch(
  `${dashboardActivePools}\n${poolView}`,
  /fetch\(`\/api\/tournaments\/leaderboard[^`]+`[^)]*cache:\s*'no-store'/,
  'client live-score polling should not bypass the short CDN cache'
)
assert.doesNotMatch(
  dashboardActivePools,
  /fetchLiveLeaderboards\(\)\s*\n\s*const intervalId = window\.setInterval/,
  'dashboard should not immediately fire an extra live-score request on mount'
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
assert.equal(existsSync('src/proxy.ts'), false, 'proxy middleware should stay removed; protected routes use server-page auth checks')

console.log('Vercel request throttle contracts verified')
