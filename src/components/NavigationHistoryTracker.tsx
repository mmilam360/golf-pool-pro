'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const CURRENT_ROUTE_KEY = 'gpp_current_route'
const PREVIOUS_ROUTE_KEY = 'gpp_previous_route'

const blockedRoutePrefixes = [
  '/api/auth/logout',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
]

function isBlockedRoute(path: string) {
  return blockedRoutePrefixes.some(prefix => path === prefix || path.startsWith(`${prefix}/`))
}

export function isSafeBackRoute(path: string | null | undefined) {
  if (!path || !path.startsWith('/')) return false
  if (path.startsWith('//')) return false
  const pathname = path.split(/[?#]/, 1)[0] || path
  return !isBlockedRoute(pathname)
}

export function getStoredBackRoute() {
  if (typeof window === 'undefined') return null
  try {
    const previous = window.sessionStorage.getItem(PREVIOUS_ROUTE_KEY)
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
    if (!isSafeBackRoute(previous) || previous === current) return null
    return previous
  } catch {
    return null
  }
}

export function NavigationHistoryTracker() {
  const pathname = usePathname()

  useEffect(() => {
    const trackCurrentRoute = () => {
      try {
        const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
        const lastCurrent = window.sessionStorage.getItem(CURRENT_ROUTE_KEY)
        if (!current || current === lastCurrent) return
        if (lastCurrent && isSafeBackRoute(lastCurrent)) {
          window.sessionStorage.setItem(PREVIOUS_ROUTE_KEY, lastCurrent)
        }
        if (isSafeBackRoute(current)) {
          window.sessionStorage.setItem(CURRENT_ROUTE_KEY, current)
        }
      } catch {
        // sessionStorage can be unavailable in private/restricted browsing; back button falls back safely.
      }
    }

    const originalPushState = window.history.pushState
    const originalReplaceState = window.history.replaceState
    const notifyRouteChange = () => window.setTimeout(trackCurrentRoute, 0)
    window.history.pushState = function pushState(...args) {
      const result = originalPushState.apply(this, args)
      notifyRouteChange()
      return result
    }
    window.history.replaceState = function replaceState(...args) {
      const result = originalReplaceState.apply(this, args)
      notifyRouteChange()
      return result
    }

    trackCurrentRoute()
    window.addEventListener('hashchange', trackCurrentRoute)
    window.addEventListener('popstate', trackCurrentRoute)
    return () => {
      window.history.pushState = originalPushState
      window.history.replaceState = originalReplaceState
      window.removeEventListener('hashchange', trackCurrentRoute)
      window.removeEventListener('popstate', trackCurrentRoute)
    }
  }, [pathname])

  return null
}
