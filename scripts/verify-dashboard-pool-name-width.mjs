import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dashboard = readFileSync('src/components/DashboardActivePools.tsx', 'utf8')
const poolView = readFileSync('src/app/(app)/pool/[id]/PoolView.tsx', 'utf8')

assert.ok(
  dashboard.includes("eventBegun ? 'grid-cols-[32px_minmax(0,1fr)_auto_78px] sm:grid-cols-[40px_minmax(0,1fr)_auto_108px]' : 'grid-cols-[32px_minmax(0,1fr)_auto] sm:grid-cols-[40px_minmax(0,1fr)_auto]'"),
  'dashboard active-pool switcher should use auto status columns and no fixed empty score column before live scoring'
)
assert.ok(
  !dashboard.includes("grid-cols-[32px_minmax(0,1fr)_64px_96px]"),
  'dashboard active-pool switcher should not reserve the old wide fixed columns that squeezed pool names'
)
assert.ok(
  !dashboard.includes(') : <div />}'),
  'dashboard active-pool switcher should not render a blank score column before scoring starts'
)
assert.ok(
  dashboard.includes('className="mx-auto mt-1 max-w-[98%] truncate text-[10px] font-black uppercase tracking-[0.04em] text-[#005b3c] sm:text-xs sm:tracking-[0.08em]" title={pool.name}>{pool.name}</p>'),
  'dashboard board subtitle should use wider/lower-tracking pool-name treatment'
)
assert.ok(
  dashboard.includes('className="min-w-0 truncate pb-0.5 text-base font-black leading-tight text-[#0f2f25] sm:text-lg" title={pool.name}>{pool.name}</p>'),
  'dashboard switcher pool name should expose full title and stay readable while truncating'
)
assert.ok(
  poolView.includes('className="mx-auto mt-1 max-w-[98%] truncate text-[10px] font-black uppercase tracking-[0.04em] text-[#005b3c] sm:text-xs sm:tracking-[0.08em]" title={poolName}>{poolName}</p>'),
  'pool page board subtitle should match the wider/lower-tracking pool-name treatment'
)
assert.ok(
  dashboard.includes('inline-flex min-h-6 items-center gap-1 whitespace-nowrap border border-[#1f6b4a]') &&
  dashboard.includes('inline-flex min-h-6 items-center gap-1 whitespace-nowrap border border-[#b58a3a]') &&
  dashboard.includes('inline-flex min-h-6 items-center whitespace-nowrap border border-[#f0c8c3]'),
  'dashboard pick-count and lock badges should share the same compact height and baseline treatment'
)

console.log('dashboard pool-name width verified')
