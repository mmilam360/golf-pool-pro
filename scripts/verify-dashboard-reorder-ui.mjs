import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/DashboardActivePools.tsx', 'utf8')

assert.ok(source.includes("import { applySavedPoolOrder, movePoolId } from '@/lib/dashboard-pool-order'"), 'dashboard should use shared pool-order helpers')
assert.ok(source.includes('window.localStorage.setItem(storageKey, JSON.stringify(orderedPoolIds))'), 'dashboard pool order should persist in localStorage')
assert.ok(source.includes('{orderedCards.map(({ pool, tournament, role, entry }, index) => {'), 'dashboard should render active pools in saved order')
assert.ok(source.includes('Hold and drag') && source.includes('Move'), 'dashboard should expose hold/drag reorder handle')
assert.ok(source.includes('Up') && source.includes('Down'), 'dashboard should include fallback move controls for touch users')
assert.ok(source.includes("mode === 'player' && orderedCards.length > 1"), 'reorder controls should only show for player dashboards with multiple active pools')

console.log('dashboard reorder UI verified')
