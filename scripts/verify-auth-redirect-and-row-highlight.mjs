import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const proxySource = readFileSync(new URL('../src/proxy.ts', import.meta.url), 'utf8')
const dashboardSource = readFileSync(new URL('../src/components/DashboardActivePools.tsx', import.meta.url), 'utf8')
const poolViewSource = readFileSync(new URL('../src/app/(app)/pool/[id]/PoolView.tsx', import.meta.url), 'utf8')
const groupedLeaderboardSource = readFileSync(new URL('../src/components/GroupedPoolLeaderboard.tsx', import.meta.url), 'utf8')
const leaderboardSources = `${dashboardSource}\n${poolViewSource}\n${groupedLeaderboardSource}`

assert.match(proxySource, /if \(user && pathname === '\/'\)/, 'signed-in users should be redirected from homepage')
assert.match(proxySource, /NextResponse\.redirect\(new URL\('\/dashboard'/, 'homepage redirect should target dashboard')
assert.match(proxySource, /'\/'/, 'proxy matcher should include the homepage')

assert.doesNotMatch(leaderboardSources, /outline outline-4 outline\[#f3df9c\]/, 'highlighted entry rows should not use gold outline bars')
assert.match(leaderboardSources, /bg-\[#eaf5ec\]/, 'highlighted/current entry rows should use faint green fill')
assert.match(dashboardSource, /Jump to my entry/, 'dashboard board jump button should use clear text')
assert.doesNotMatch(dashboardSource, />\s*My row\s*</, 'dashboard board jump button should not use the vague My row label')

assert.match(dashboardSource, /const showToday = Boolean\(priorRound \|\| isAfterOpeningRoundDate\(tournament\)\)/, 'dashboard status card should gate Today display until after opening day/prior round')
assert.match(dashboardSource, /todayScore: showToday \? current\.todayScore : null/, 'dashboard status card should hide Thursday-only Today score')
assert.match(dashboardSource, /movementToday: showToday && priorEntries\.length > 0/, 'dashboard movement should follow the same Today gate')

assert.match(dashboardSource, /formatEntryCount\(entries\.length\)/, 'expanded leaderboard header should carry the entry count')
assert.doesNotMatch(dashboardSource, /formatEntryCount\(poolEntries\.length\)/, 'collapsed pool rows should not spend width on entry count')
assert.match(dashboardSource, /function LiveScoreStrip\(\)/, 'live state should render as a compact strip inside the rank score box')
assert.doesNotMatch(dashboardSource, /LivePulseBadge/, 'collapsed live badge should not render as a separate column')
assert.match(dashboardSource, /grid-cols-\[32px_minmax\(0,1fr\)_90px\]/, 'live collapsed rows should reserve only chevron, name, and score box columns')
assert.doesNotMatch(dashboardSource, /grid-cols-\[32px_minmax\(0,1fr\)_auto_78px\]/, 'live collapsed rows should not keep the old separate live/status column')

console.log('auth redirect, row highlight, jump button, Thursday Today gate, and compact active-pool rows verified')
