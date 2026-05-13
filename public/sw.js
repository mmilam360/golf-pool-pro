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
