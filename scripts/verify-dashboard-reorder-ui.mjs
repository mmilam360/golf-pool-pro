import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/DashboardActivePools.tsx', 'utf8')

assert.ok(source.includes("import { applySavedPoolOrder, movePoolId } from '@/lib/dashboard-pool-order'"), 'dashboard should use shared pool-order helpers')
assert.ok(source.includes('window.localStorage.setItem(storageKey, JSON.stringify(orderedPoolIds))'), 'dashboard pool order should persist in localStorage')
assert.ok(source.includes('{orderedCards.map(({ pool, tournament, role, entry }, index) => {'), 'dashboard should render active pools in saved order')
assert.ok(source.includes('Drag') && source.includes('title="Drag to reorder"'), 'dashboard should expose a direct drag reorder handle')
assert.ok(source.includes('Up') && source.includes('Down'), 'dashboard should include fallback move controls for touch users')
assert.ok(source.includes("const canSortPools = mode === 'player' && orderedCards.length > 1"), 'sort button should only show for player dashboards with multiple active pools')
assert.ok(source.includes("{sortMode ? 'Done' : 'Sort'}"), 'active pools header should use Sort/Done toggle')
assert.ok(source.includes('const canReorderPools = canSortPools && sortMode'), 'row reorder controls should only show while sort mode is enabled')
assert.ok(source.includes('const [expandedPoolIds, setExpandedPoolIds] = useState<Set<string>>(() => new Set())'), 'dashboard should wait for saved order before expanding a pool')
assert.ok(source.includes('setPoolOrderHydrated(true)'), 'dashboard should mark saved order hydration before initial auto-expand')
assert.ok(source.includes('setExpandedPoolIds(new Set([orderedPoolIds[0]]))'), 'dashboard should auto-expand the first saved-order pool')
assert.ok(source.includes('initialExpandedPoolSetRef.current = true'), 'dashboard should only set initial expanded pool once')
assert.ok(source.includes('{isPoolOpen ? (') && source.includes('<InlineLeaderboard'), 'dashboard should only render heavy leaderboard content for expanded pools')

console.log('dashboard reorder UI verified')
