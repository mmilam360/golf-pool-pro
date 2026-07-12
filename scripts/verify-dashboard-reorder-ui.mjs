import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/DashboardActivePools.tsx', 'utf8')

assert.ok(source.includes("import { applySavedPoolOrder, movePoolId } from '@/lib/dashboard-pool-order'"), 'dashboard should use shared pool-order helpers')
assert.ok(source.includes('window.localStorage.setItem(storageKey, JSON.stringify(orderedPoolIds))'), 'dashboard pool order should persist in localStorage')
assert.ok(source.includes('const displayCards = useMemo(() => orderedCards.map') && source.includes('{displayCards.map(({ pool, role, entry, effectiveTournament, effectivePool, poolEntries, rankPreview, label, eventBegun, tournamentDisplayName }, index) => {'), 'dashboard should precompute and render active pools in saved order')
assert.ok(!source.includes('draggable') && !source.includes('onDragStart') && !source.includes('Drag to reorder'), 'dashboard should not expose broken drag controls')
assert.ok(source.includes('title="Move up"') && source.includes('title="Move down"'), 'arrow controls should describe their direction')
assert.ok(source.includes("const canSortPools = mode === 'player' && orderedCards.length > 1"), 'sort button should only show for player dashboards with multiple active pools')
assert.ok(source.includes("{sortMode ? 'Done' : 'Sort'}"), 'active pools header should use Sort/Done toggle')
assert.ok(source.includes('const canReorderPools = canSortPools && sortMode'), 'row reorder controls should only show while sort mode is enabled')
assert.ok(source.includes('function initialExpandedPoolIds(cards: ActivePoolCard[], storageKey: string)') && source.includes('const [expandedPoolIds, setExpandedPoolIds] = useState<Set<string>>(() => initialExpandedPoolIds(cards, viewStateKey))'), 'dashboard should open the first available/saved pool on initial load')
assert.ok(source.includes('const [sortAutoExpandSuppressed, setSortAutoExpandSuppressed] = useState(false)'), 'dashboard should track when sort mode has suppressed auto expansion')
assert.ok(source.includes('function handleSortModeToggle()') && source.includes('setExpandedPoolIds(new Set())') && source.includes('setSortAutoExpandSuppressed(true)'), 'entering/leaving sort mode should collapse all pools and suppress auto expansion')
assert.ok(source.includes('if (!poolOrderHydrated || !savedTopPoolId || sortMode || sortAutoExpandSuppressed) return'), 'saved-order auto expansion should not run during or after sort mode')
assert.ok(source.includes('const isPoolOpen = !canReorderPools && (useSinglePoolMobileLayout || expandedPoolIds.has(pool.id))'), 'sort mode should force pool details closed even if an expanded id is still present')
assert.ok(
  source.indexOf('const canReorderPools = canSortPools && sortMode') < source.indexOf('const isPoolOpen = !canReorderPools'),
  'canReorderPools must be declared before isPoolOpen uses it',
)
assert.ok(source.includes('if (canReorderPools) event.preventDefault()'), 'summary taps should not expand/collapse pools while sort controls are active')
assert.ok(source.includes('event.preventDefault()') && source.includes('event.stopPropagation()'), 'arrow clicks should not toggle the surrounding pool row')
assert.ok(source.includes('{isPoolOpen ? (') && source.includes('<InlineLeaderboard'), 'dashboard should only render heavy leaderboard content for expanded pools')

console.log('dashboard reorder UI verified')
