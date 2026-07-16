import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const dashboardPerformance = readFileSync('src/lib/dashboard-performance.ts', 'utf8')
const dashboardActivePools = readFileSync('src/components/DashboardActivePools.tsx', 'utf8')
const poolView = readFileSync('src/app/(app)/pool/[id]/PoolView.tsx', 'utf8')
const serviceWorkerRegister = readFileSync('src/components/ServiceWorkerRegister.tsx', 'utf8')
const leaderboardApi = readFileSync('src/app/api/tournaments/leaderboard/route.ts', 'utf8')
const cronRunLog = readFileSync('src/lib/cron-run-log.ts', 'utf8')
const vercelConfig = JSON.parse(readFileSync('vercel.json', 'utf8'))

function isLiveScoreCron(cron) {
  return cron.path === '/api/cron/sync-tournaments?live=1'
}

function cronRunsMoreOftenThanAllowed(cron) {
  const schedule = cron.schedule
  const parts = schedule.trim().split(/\s+/)
  if (parts.length !== 5) return true
  const [minute] = parts
  if (isLiveScoreCron(cron)) return minute !== '*/5'
  return !/^(?:[0-5]?\d)$/.test(minute)
}

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

for (const cron of vercelConfig.crons || []) {
  assert.equal(
    cronRunsMoreOftenThanAllowed(cron),
    false,
    `${cron.path} has an unsafe schedule`
  )
}
assert.match(
  cronRunLog,
  /return canonicalDedupeRoute\(route\) === '\/api\/cron\/sync-tournaments\?live=1' \? 5 : 60/,
  'live score cron should dedupe to five-minute buckets while other cron routes stay hourly'
)
assert.match(
  cronRunLog,
  /return '\/api\/cron\/sync-tournaments\?live=1'/,
  'live score cron dedupe should canonicalize query params so cache-busting params cannot bypass the five-minute bucket'
)
assert.match(
  cronRunLog,
  /bucket\.setUTCMinutes\(Math\.floor\(bucket\.getUTCMinutes\(\) \/ windowMinutes\) \* windowMinutes\)/,
  'cron route dedupe should bucket executions by the configured safety window'
)

console.log('Vercel request throttle contracts verified')
