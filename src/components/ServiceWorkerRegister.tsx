'use client'

import { useEffect } from 'react'

const SERVICE_WORKER_UPDATE_CHECK_KEY = 'gpp_sw_update_checked_at'
const SERVICE_WORKER_UPDATE_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000

function shouldCheckForServiceWorkerUpdate(now = Date.now()) {
  try {
    const lastChecked = Number(window.localStorage.getItem(SERVICE_WORKER_UPDATE_CHECK_KEY) || 0)
    if (Number.isFinite(lastChecked) && now - lastChecked < SERVICE_WORKER_UPDATE_CHECK_INTERVAL_MS) return false
    window.localStorage.setItem(SERVICE_WORKER_UPDATE_CHECK_KEY, String(now))
  } catch {
    // If storage is unavailable, do the normal update check.
  }
  return true
}

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
        if (shouldCheckForServiceWorkerUpdate()) registration.update().catch(() => undefined)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
