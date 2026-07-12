const CACHE_VERSION = '20260712-pwa-images-speed'
const STATIC_CACHE = `gpp-static-${CACHE_VERSION}`
const IMAGE_CACHE = `gpp-public-images-${CACHE_VERSION}`
const OFFLINE_CACHE = `gpp-offline-${CACHE_VERSION}`
const EXPECTED_CACHES = [STATIC_CACHE, IMAGE_CACHE, OFFLINE_CACHE]

const VERSIONED_WORDMARK_URL = '/brand/golf-pools-pro-wordmark.d3f016dcc364.webp'
const ICON_192_URL = '/icons/icon-192.png?v=4'
const ICON_512_URL = '/icons/icon-512.png?v=4'
const APPLE_TOUCH_ICON_URL = '/apple-touch-icon.png?v=4'
const FAVICON_ICO_URL = '/favicon.ico?v=4'
const FAVICON_SVG_URL = '/favicon.svg?v=4'
const MANIFEST_URL = '/manifest.webmanifest'
const OFFLINE_FALLBACK_URL = '/__gpp-offline-fallback__'

const PRECACHE_ASSETS = [
  ICON_192_URL,
  ICON_512_URL,
  APPLE_TOUCH_ICON_URL,
  FAVICON_ICO_URL,
  FAVICON_SVG_URL,
  MANIFEST_URL,
  VERSIONED_WORDMARK_URL,
]

const OFFLINE_FALLBACK_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0b2f24">
  <title>Golf Pools Pro offline</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #fbf7ed; color: #1f2a24; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { width: min(30rem, calc(100vw - 2rem)); border: 2px solid #123c2f; background: #fffdf8; padding: 1.25rem; box-shadow: 6px 6px 0 #d8cab0; }
    img { display: block; width: 12rem; max-width: 70%; height: auto; margin-bottom: 1rem; }
    p.eyebrow { margin: 0 0 .5rem; color: #8a6724; font-size: .72rem; font-weight: 900; letter-spacing: .16em; text-transform: uppercase; }
    h1 { margin: 0; color: #123c2f; font-size: 1.65rem; line-height: 1.05; }
    p { margin: .8rem 0 0; line-height: 1.55; font-weight: 650; color: #4f5b52; }
  </style>
</head>
<body>
  <main>
    <img src="${VERSIONED_WORDMARK_URL}" alt="Golf Pools Pro">
    <p class="eyebrow">Offline</p>
    <h1>The app shell is ready. Reconnect to load live pool data.</h1>
    <p>Golf Pools Pro does not cache private leaderboards or account pages for offline use. Try again when your connection is back.</p>
  </main>
</body>
</html>`

function isCacheableResponse(response) {
  if (!response || !response.ok) return false
  if (response.type && !['basic', 'default'].includes(response.type)) return false
  const cacheControl = response.headers.get('Cache-Control') || ''
  return !/no-store|private/i.test(cacheControl)
}

function isSameOrigin(url) {
  return url.origin === self.location.origin
}

function isApiRequest(url) {
  return url.pathname.startsWith('/api/')
}

function matchesAssetUrl(url, assetPath) {
  const assetUrl = new URL(assetPath, self.location.origin)
  return url.pathname === assetUrl.pathname && url.search === assetUrl.search
}

function isPrecachedAsset(url) {
  return PRECACHE_ASSETS.some(assetPath => matchesAssetUrl(url, assetPath))
}

function isNextStaticAsset(url) {
  return isSameOrigin(url) && url.pathname.startsWith('/_next/static/')
}

function isSafePublicAssetPath(pathname) {
  return pathname.startsWith('/icons/')
    || pathname.startsWith('/brand/')
    || pathname.startsWith('/share/')
    || pathname === '/favicon.ico'
    || pathname === '/favicon.svg'
    || pathname === '/apple-touch-icon.png'
}

function isVersionedImmutableAsset(url) {
  if (!isSameOrigin(url)) return false
  if (isNextStaticAsset(url)) return true
  if (url.pathname === VERSIONED_WORDMARK_URL) return true
  return url.searchParams.has('v') && isSafePublicAssetPath(url.pathname)
}

function isSafePublicImage(url) {
  return isSameOrigin(url)
    && isSafePublicAssetPath(url.pathname)
    && /\.(?:avif|gif|ico|jpe?g|png|svg|webp)$/i.test(url.pathname)
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (isCacheableResponse(response)) {
    await cache.put(request, response.clone())
  }
  return response
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  const networkPromise = fetch(request)
    .then(response => {
      if (isCacheableResponse(response)) {
        cache.put(request, response.clone()).catch(() => undefined)
      }
      return response
    })
    .catch(() => undefined)

  if (cached) {
    networkPromise.catch(() => undefined)
    return cached
  }

  const networkResponse = await networkPromise
  return networkResponse || Response.error()
}

async function navigationNetworkFirst(event) {
  try {
    const preloadResponse = await event.preloadResponse
    if (preloadResponse) return preloadResponse
    return await fetch(event.request)
  } catch {
    const cachedFallback = await caches.match(OFFLINE_FALLBACK_URL)
    return cachedFallback || new Response(OFFLINE_FALLBACK_HTML, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
}

self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(cache => cache.addAll(PRECACHE_ASSETS)).catch(() => undefined),
      caches.open(OFFLINE_CACHE).then(cache => cache.put(OFFLINE_FALLBACK_URL, new Response(OFFLINE_FALLBACK_HTML, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }))).catch(() => undefined),
    ])
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      self.registration.navigationPreload ? self.registration.navigationPreload.enable().catch(() => undefined) : Promise.resolve(),
      caches.keys().then(keys => Promise.all(keys
        .filter(key => !EXPECTED_CACHES.includes(key))
        .map(key => caches.delete(key)))),
    ]).then(() => self.clients.claim())
  )
})

self.addEventListener('message', event => {
  if (event.data?.type === 'GPP_SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('push', event => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }
  const title = data.title || 'Golf Pools Pro'
  const options = {
    body: data.body || 'Pool update available.',
    tag: data.tag || 'gpp-notification',
    icon: ICON_192_URL,
    badge: ICON_192_URL,
    data: { url: data.url || '/dashboard' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const targetUrl = new URL(event.notification?.data?.url || '/dashboard', self.location.origin).href
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client && client.url.startsWith(self.location.origin)) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      return clients.openWindow(targetUrl)
    })
  )
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (!isSameOrigin(url) || isApiRequest(url)) return

  if (request.mode === 'navigate') {
    event.respondWith(navigationNetworkFirst(event))
    return
  }

  if (isNextStaticAsset(url) || isVersionedImmutableAsset(url) || isPrecachedAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  if (isSafePublicImage(url)) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE))
  }
})
