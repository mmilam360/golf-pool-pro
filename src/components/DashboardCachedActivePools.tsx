'use client'

import { useEffect, useState } from 'react'
import DashboardActivePools from '@/components/DashboardActivePools'
import { createClient } from '@/lib/supabase/client'
import {
  clearAllDashboardActivePoolsCacheStorage,
  clearDashboardActivePoolsCacheStorage,
  dashboardActivePoolsCacheStorageKey,
} from '@/lib/dashboard-cache'
import {
  cachedDashboardSnapshotIsUsableForUser,
  cachedDashboardSnapshotNeedsScoreUpdate,
  type DashboardCachedSnapshot,
} from '@/lib/dashboard-performance'

type DashboardActivePoolsProps = Parameters<typeof DashboardActivePools>[0]

type CachedDashboard = DashboardCachedSnapshot<DashboardActivePoolsProps['cards'][number]> & {
  cards?: DashboardActivePoolsProps['cards']
  entriesByPool?: DashboardActivePoolsProps['entriesByPool']
}

function parseCachedDashboard(raw: string | null): CachedDashboard | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as CachedDashboard
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

function readCachedDashboardForUser(userId: string): CachedDashboard | null {
  try {
    const keyedStorageKey = dashboardActivePoolsCacheStorageKey('player', userId)
    const keyed = parseCachedDashboard(window.localStorage.getItem(keyedStorageKey))
    if (keyed) return keyed

    // Migrate one older shared-key snapshot only after the local Supabase session proves the user id.
    const legacyStorageKey = dashboardActivePoolsCacheStorageKey('player')
    const legacy = parseCachedDashboard(window.localStorage.getItem(legacyStorageKey))
    if (legacy?.userId === userId) {
      window.localStorage.setItem(keyedStorageKey, JSON.stringify(legacy))
      window.localStorage.removeItem(legacyStorageKey)
      return legacy
    }
    if (legacy && legacy.userId !== userId) window.localStorage.removeItem(legacyStorageKey)
    return null
  } catch {
    return null
  }
}

function CachedDashboardNotice({ updatingScores }: { updatingScores: boolean }) {
  return (
    <section aria-live="polite" className="mb-3 border-2 border-[#b58a3a] bg-[#fff4cf] px-4 py-3 text-sm shadow-[4px_4px_0_#eadfca] sm:mb-4 sm:px-5">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7a5a19]">{updatingScores ? 'Updating scores' : 'Refreshing dashboard'}</p>
      <p className="mt-1 font-semibold text-[#1f2a24]">Showing your saved dashboard while fresh data loads.</p>
    </section>
  )
}

export default function DashboardCachedActivePools() {
  const [cached, setCached] = useState<CachedDashboard | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function loadCacheForCurrentUser() {
      // This is only a local identity check for an already user-keyed localStorage snapshot.
      // The real dashboard page still performs server-side Supabase auth before private data renders.
      const { data } = await supabase.auth.getSession()
      const userId = data.session?.user?.id ?? null
      if (!userId) {
        clearAllDashboardActivePoolsCacheStorage()
        if (!cancelled) setCached(null)
        return
      }

      const nextCached = readCachedDashboardForUser(userId)
      if (!nextCached || !cachedDashboardSnapshotIsUsableForUser(nextCached, userId)) {
        clearDashboardActivePoolsCacheStorage('player', userId)
        if (!cancelled) setCached(null)
        return
      }

      if (!cancelled) setCached(nextCached)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        clearAllDashboardActivePoolsCacheStorage()
        setCached(null)
        return
      }
      setCached(current => (current?.userId === session.user.id ? current : null))
    })

    loadCacheForCurrentUser().catch(() => {
      if (!cancelled) setCached(null)
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  if (!cached?.cards?.length || !cached.entriesByPool) {
    return (
      <section className="border-2 border-[#123c2f] bg-white p-5 shadow-[7px_7px_0_#d8cab0] sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a6724]">Loading dashboard</p>
        <h2 className="mt-2 font-display text-2xl font-bold text-[#0f2f25]">Getting your pools ready…</h2>
      </section>
    )
  }

  return (
    <>
      <CachedDashboardNotice updatingScores={cachedDashboardSnapshotNeedsScoreUpdate(cached)} />
      <DashboardActivePools cards={cached.cards} entriesByPool={cached.entriesByPool} snapshot />
    </>
  )
}
