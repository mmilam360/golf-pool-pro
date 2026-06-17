'use client'

import { useEffect, useState } from 'react'
import DashboardActivePools, { DASHBOARD_ACTIVE_POOLS_CACHE_KEY } from '@/components/DashboardActivePools'
import { createClient } from '@/lib/supabase/client'
import { hasOnCourseScores } from '@/lib/golf-live'
import { hasWeekendCutStatusErrors } from '@/lib/leaderboard-sanity'

type DashboardActivePoolsProps = Parameters<typeof DashboardActivePools>[0]

type CachedDashboard = {
  version?: number
  cachedAt?: number
  userId?: string | null
  cards?: DashboardActivePoolsProps['cards']
  entriesByPool?: DashboardActivePoolsProps['entriesByPool']
}

const CACHE_MAX_AGE_MS = 5 * 60 * 1000

function cachedTournamentStartHasArrived(startDate?: string | null) {
  if (!startDate) return false
  const dateOnlyMatch = startDate.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (dateOnlyMatch) {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}` <= today
  }

  const parsed = new Date(startDate)
  return Number.isFinite(parsed.getTime()) && parsed.getTime() <= Date.now()
}

function cachedCardHasLiveOrBadScores(card: DashboardActivePoolsProps['cards'][number]) {
  const tournament = card.tournament
  const status = String(tournament?.status || '').toLowerCase()
  return status === 'live'
    || status === 'completed'
    || cachedTournamentStartHasArrived(tournament?.start_date)
    || hasOnCourseScores(tournament?.leaderboard_json)
    || hasWeekendCutStatusErrors(tournament?.leaderboard_json)
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
    let cancelled = false
    async function loadCacheForCurrentUser() {
      const nextCached = readCachedDashboard()
      if (!nextCached?.userId) {
        if (!cancelled) setCached(null)
        return
      }

      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      if (!cancelled && data.user?.id === nextCached.userId) setCached(nextCached)
      else if (!cancelled) setCached(null)
    }

    loadCacheForCurrentUser().catch(() => {
      if (!cancelled) setCached(null)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!cached?.cards?.length || !cached.entriesByPool || cached.cards.some(cachedCardHasLiveOrBadScores)) {
    return (
      <section className="border-2 border-[#123c2f] bg-white p-5 shadow-[7px_7px_0_#d8cab0] sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a6724]">Loading dashboard</p>
        <h2 className="mt-2 font-display text-2xl font-bold text-[#0f2f25]">Getting your pools ready…</h2>
      </section>
    )
  }

  return <DashboardActivePools cards={cached.cards} entriesByPool={cached.entriesByPool} snapshot />
}
