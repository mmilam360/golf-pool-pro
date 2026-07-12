export const DASHBOARD_ACTIVE_POOLS_CACHE_KEY = 'gpp-dashboard-active-pools-cache'
export const DASHBOARD_ACTIVE_POOLS_CACHE_VERSION = 1

export type DashboardActivePoolsCacheMode = 'player' | 'runner' | string

export function dashboardActivePoolsCacheStorageKey(mode: DashboardActivePoolsCacheMode = 'player', userId?: string | null) {
  return userId ? `${DASHBOARD_ACTIVE_POOLS_CACHE_KEY}:${mode}:${userId}` : `${DASHBOARD_ACTIVE_POOLS_CACHE_KEY}:${mode}`
}

export function clearDashboardActivePoolsCacheStorage(mode: DashboardActivePoolsCacheMode = 'player', userId?: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (userId) window.localStorage.removeItem(dashboardActivePoolsCacheStorageKey(mode, userId))
    // Remove the legacy shared key too so account switches and logout cannot show a stale private snapshot.
    window.localStorage.removeItem(dashboardActivePoolsCacheStorageKey(mode))
  } catch {
    // Cache clearing is best-effort; auth/logout must not be blocked by restricted storage modes.
  }
}

export function clearAllDashboardActivePoolsCacheStorage() {
  if (typeof window === 'undefined') return
  try {
    const keysToRemove: string[] = []
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (key && key.startsWith(`${DASHBOARD_ACTIVE_POOLS_CACHE_KEY}:`)) keysToRemove.push(key)
    }
    keysToRemove.forEach(key => window.localStorage.removeItem(key))
  } catch {
    // Cache clearing is best-effort; auth/logout must not be blocked by restricted storage modes.
  }
}
