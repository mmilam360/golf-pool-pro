'use client'

import { useEffect, useState } from 'react'
import DashboardActivePools, { DASHBOARD_ACTIVE_POOLS_CACHE_KEY } from '@/components/DashboardActivePools'
import { hasOnCourseScores } from '@/lib/golf-live'

type DashboardActivePoolsProps = Parameters<typeof DashboardActivePools>[0]

type CachedDashboard = {
  version?: number
  cachedAt?: number
  cards?: DashboardActivePoolsProps['cards']
  entriesByPool?: DashboardActivePoolsProps['entriesByPool']
}

const CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000

function cachedCardHasLiveScores(card: DashboardActivePoolsProps['cards'][number]) {
  const tournament = card.tournament
  return tournament?.status === 'live' || hasOnCourseScores(tournament?.leaderboard_json)
}

function readCachedDashboard(): CachedDashboard | null {
  try {
    const raw = window.localStorage.getItem(`${DASHBOARD_ACTIVE_POOLS_CACHE_KEY}:player`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedDashboard
    if (parsed.version !== 1) return null
    if (!parsed.cachedAt || Date.now() - parsed.cachedAt > CACHE_MAX_AGE_MS) return null
    if (!Array.isArray(parsed.cards) || !parsed.entriesByPool || typeof parsed.entriesByPool !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export default function DashboardCachedActivePools() {
  const [cached, setCached] = useState<CachedDashboard | null>(null)

  useEffect(() => {
    setCached(readCachedDashboard())
  }, [])

  if (!cached?.cards?.length || !cached.entriesByPool || cached.cards.some(cachedCardHasLiveScores)) {
    return (
      <section className="border-2 border-[#123c2f] bg-white p-5 shadow-[7px_7px_0_#d8cab0] sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a6724]">Loading dashboard</p>
        <h2 className="mt-2 font-display text-2xl font-bold text-[#0f2f25]">Getting your pools ready…</h2>
      </section>
    )
  }

  return <DashboardActivePools cards={cached.cards} entriesByPool={cached.entriesByPool} snapshot />
}
