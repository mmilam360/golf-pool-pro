import { readFileSync } from 'node:fs'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const backButton = readFileSync(new URL('../src/components/BackButton.tsx', import.meta.url), 'utf8')
const navigationTracker = readFileSync(new URL('../src/components/NavigationHistoryTracker.tsx', import.meta.url), 'utf8')
const appHeader = readFileSync(new URL('../src/components/AppHeader.tsx', import.meta.url), 'utf8')
const poolView = readFileSync(new URL('../src/app/(app)/pool/[id]/PoolView.tsx', import.meta.url), 'utf8')
const dashboardPage = readFileSync(new URL('../src/app/(app)/dashboard/page.tsx', import.meta.url), 'utf8')
const managePoolsPage = readFileSync(new URL('../src/app/(app)/manage-pools/page.tsx', import.meta.url), 'utf8')

assert(backButton.includes('referrer.hash'), 'BackButton should preserve hash routes like #make-picks')
assert(backButton.includes('router.replace(target)'), 'BackButton should replace instead of pushing a loop onto browser history')
assert(backButton.includes('disabled={navigating}'), 'BackButton should block repeated taps while navigation starts')

assert(navigationTracker.includes('originalPushState') && navigationTracker.includes('window.history.pushState = function pushState'), 'NavigationHistoryTracker should track query-only pushState route changes without useSearchParams CSR bailout')
assert(navigationTracker.includes("addEventListener('hashchange'"), 'NavigationHistoryTracker should track hash route changes')
assert(navigationTracker.includes("addEventListener('popstate'"), 'NavigationHistoryTracker should react to Android/browser back navigation')

assert(appHeader.includes('clientHash'), 'AppHeader login redirect should preserve hash after hydration')
assert(appHeader.includes('[pathname, searchKey]'), 'Mobile menu should close on query-only navigation too')

assert(poolView.includes('const [removingEntryId'), 'PoolView should guard entry removal with pending state')
assert(poolView.includes('if (removingEntryId) return'), 'Entry removal should ignore repeated taps')
assert(poolView.includes('void refreshPoolEntries()'), 'Entry removal should refresh entries without full route churn')
const removeEntryBody = poolView.slice(poolView.indexOf('async function removeEntry'), poolView.indexOf('  // Lock pool permanently'))
assert(!removeEntryBody.includes('router.refresh()'), 'Entry removal should not trigger full router.refresh jank')
assert(poolView.includes("addEventListener('popstate', applyRouteState)"), 'PoolView tab state should react to Android/browser back')
assert(poolView.includes('selectPoolTab(t)'), 'Pool tabs should use the URL/history-aware selector')
assert(poolView.includes('window.history.pushState'), 'Pool tabs should push browser history entries')
assert(poolView.includes('setTab(defaultTab)'), 'PoolView should reset to the default tab when query/hash state is cleared')

assert(dashboardPage.includes("redirect('/login?redirect=%2Fdashboard')"), 'Dashboard login redirect should preserve destination')
assert(managePoolsPage.includes("redirect('/login?redirect=%2Fmanage-pools')"), 'Manage Pools login redirect should preserve destination')

console.log('Mobile navigation guards verified')
