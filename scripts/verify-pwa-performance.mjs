import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'

const sw = readFileSync('public/sw.js', 'utf8')
const manifest = readFileSync('src/app/manifest.ts', 'utf8')
const nextConfig = readFileSync('next.config.ts', 'utf8')
const home = readFileSync('src/app/page.tsx', 'utf8')
const vitals = readFileSync('src/components/WebVitalsReporter.tsx', 'utf8')
const wordmarkPath = 'public/brand/golf-pools-pro-wordmark.d3f016dcc364.webp'
const wordmarkUrl = '/brand/golf-pools-pro-wordmark.d3f016dcc364.webp'

assert.ok(sw.includes("if (!isSameOrigin(url) || isApiRequest(url)) return"), 'service worker must ignore cross-origin and API requests')
assert.ok(sw.includes("if (request.mode === 'navigate')") && sw.includes('navigationNetworkFirst(event)'), 'navigations must use the network with an offline fallback')
assert.ok(!sw.includes("SHELL_ASSETS = ['/"), 'service worker must not precache private-capable HTML routes')
assert.ok(sw.includes("url.pathname.startsWith('/_next/static/')"), 'Next static chunks should use the static cache')
assert.ok(sw.includes('navigationPreload.enable()'), 'navigation preload should be enabled')
assert.ok(sw.includes("event.data?.type === 'GPP_SKIP_WAITING'"), 'waiting workers should support explicit activation')
assert.ok(sw.includes(wordmarkUrl), 'service worker should precache the versioned wordmark')
assert.ok(manifest.includes("const icon192 = '/icons/icon-192.png?v=4'") && sw.includes("const ICON_192_URL = '/icons/icon-192.png?v=4'"), 'manifest and service worker icon URLs must match')
assert.ok(nextConfig.includes(wordmarkUrl) && nextConfig.includes('max-age=31536000, immutable'), 'versioned wordmark must receive an immutable cache header')
assert.ok(home.includes('loading="lazy"') && home.includes('src="/landing/final-board-iphone-story.webp"'), 'below-fold final-board preview should lazy-load')
assert.ok(vitals.includes("routeForAnalytics(window.location.pathname)") && vitals.includes("{ includePageProperties: false }"), 'Web Vitals must report normalized routes without page URLs')
assert.ok(vitals.includes("return '/pool/[id]'") && vitals.includes("return '/leaderboard/[id]'"), 'private route identifiers must be normalized')
assert.ok(statSync(wordmarkPath).size < 30_000, 'right-sized wordmark should remain below 30 KB')

console.log('PWA and image performance contracts verified')
