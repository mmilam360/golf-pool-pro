const CACHE_NAME = 'gpp-shell-v1'
const SHELL_ASSETS = ['/', '/icons/icon-192.png', '/icons/icon-512.png', '/apple-touch-icon.png']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS)).catch(() => undefined)
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  const isSameOrigin = url.origin === self.location.origin
  const isStaticAsset = url.pathname.startsWith('/_next/static/')
    || url.pathname.startsWith('/icons/')
    || url.pathname.startsWith('/brand/')
    || url.pathname === '/favicon.ico'
    || url.pathname === '/favicon.svg'
    || url.pathname === '/apple-touch-icon.png'
    || url.pathname === '/'

  if (!isSameOrigin || url.pathname.startsWith('/api/') || (!isStaticAsset && request.mode === 'navigate')) return

  event.respondWith(
    fetch(request)
      .then(response => {
        const copy = response.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => undefined)
        return response
      })
      .catch(() => caches.match(request).then(response => response || caches.match('/')))
  )
})
