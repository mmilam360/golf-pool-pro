'use client'

import { useEffect } from 'react'

function activateWaitingWorker(registration: ServiceWorkerRegistration) {
  if (!registration.waiting) return
  registration.waiting.postMessage({ type: 'GPP_SKIP_WAITING' })
}

function watchForServiceWorkerUpdates(registration: ServiceWorkerRegistration) {
  activateWaitingWorker(registration)

  registration.addEventListener('updatefound', () => {
    const nextWorker = registration.installing
    if (!nextWorker) return

    nextWorker.addEventListener('statechange', () => {
      if (nextWorker.state === 'installed' && navigator.serviceWorker.controller) {
        activateWaitingWorker(registration)
      }
    })
  })
}

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return

    let cancelled = false
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        if (cancelled) return
        watchForServiceWorkerUpdates(registration)
        registration.update().catch(() => undefined)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
