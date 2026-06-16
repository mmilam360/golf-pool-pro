import Link from 'next/link'
import AppHeader from '@/components/AppHeader'
import RunnerIncompletePicksReminder from '@/components/RunnerIncompletePicksReminder'
import FullNameConfirmationPrompt from '@/components/FullNameConfirmationPrompt'
import { createClient } from '@/lib/supabase/server'

type RunnerPool = {
  id: string
  name: string
  pick_count?: number | null
  game_format?: string | null
  groups_finalized_at?: string | null
  is_locked?: boolean | null
  is_completed?: boolean | null
  gpp_tournaments?: { status?: string | null } | { status?: string | null }[] | null
}

type RunnerEntry = {
  id: string
  pool_id: string
  display_name?: string | null
  golfer_picks: unknown
}

type RunnerReminderPool = {
  id: string
  name: string
  incompleteCount: number
  activeEntryCount: number
  incompleteEntries: { id: string; displayName: string; submittedPickCount: number; requiredPickCount: number }[]
}

type MissingFullNameEntry = {
  id: string
  poolName: string
  displayName: string
}

type FullNamePromptData = {
  userId: string
  email: string
  displayName: string
  initialFullName: string
  entries: MissingFullNameEntry[]
}

function getTournamentStatus(pool: RunnerPool) {
  const tournament = Array.isArray(pool.gpp_tournaments) ? pool.gpp_tournaments[0] : pool.gpp_tournaments
  return String(tournament?.status || '').toLowerCase()
}


async function getFullNamePromptData(): Promise<FullNamePromptData | null> {
  const supabase = await createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: profile }, { data: entries }] = await Promise.all([
    supabase
      .from('gpp_profiles')
      .select('display_name, full_name, full_name_confirmed_at, email')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('gpp_entries')
      .select('id, pool_id, display_name, full_name, full_name_confirmed_at, gpp_pools(id, name, is_completed, gpp_tournaments(status))')
      .eq('user_id', user.id)
      .eq('is_removed', false)
      .order('created_at', { ascending: false }),
  ])

  const missingEntries = ((entries || []) as any[])
    .filter(entry => {
      const pool = Array.isArray(entry.gpp_pools) ? entry.gpp_pools[0] : entry.gpp_pools
      const tournament = Array.isArray(pool?.gpp_tournaments) ? pool.gpp_tournaments[0] : pool?.gpp_tournaments
      const confirmed = entry.full_name_confirmed_at && typeof entry.full_name === 'string' && entry.full_name.trim().length > 0
      return !confirmed && pool && !pool.is_completed && String(tournament?.status || '').toLowerCase() !== 'completed'
    })
    .map(entry => {
      const pool = Array.isArray(entry.gpp_pools) ? entry.gpp_pools[0] : entry.gpp_pools
      return {
        id: entry.id,
        poolName: pool?.name || 'Golf pool',
        displayName: entry.display_name || 'Your entry',
      }
    })

  return {
    userId: user.id,
    email: user.email || profile?.email || '',
    displayName: profile?.display_name || user.user_metadata?.display_name || '',
    initialFullName: profile?.full_name_confirmed_at ? profile?.full_name || '' : '',
    entries: missingEntries,
  }
}

async function getRunnerIncompletePickReminders(): Promise<RunnerReminderPool[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: pools } = await supabase
    .from('gpp_pools')
    .select('id, name, pick_count, game_format, groups_finalized_at, is_locked, is_completed, gpp_tournaments(status)')
    .eq('owner_id', user.id)
    .eq('is_completed', false)
    .order('created_at', { ascending: false })

  const openPools = ((pools || []) as RunnerPool[]).filter(pool => {
    const status = getTournamentStatus(pool)
    const groupsPending = pool.game_format && pool.game_format !== 'standard' && !pool.groups_finalized_at
    return !pool.is_locked && !pool.is_completed && !groupsPending && status !== 'live' && status !== 'completed'
  })

  if (openPools.length === 0) return []

  const { data: entries } = await supabase
    .from('gpp_entries')
    .select('id, pool_id, display_name, golfer_picks')
    .in('pool_id', openPools.map(pool => pool.id))
    .eq('is_removed', false)

  const entriesByPool = ((entries || []) as RunnerEntry[]).reduce<Record<string, RunnerEntry[]>>((groups, entry) => {
    groups[entry.pool_id] = groups[entry.pool_id] || []
    groups[entry.pool_id].push(entry)
    return groups
  }, {})

  return openPools
    .map(pool => {
      const poolEntries = entriesByPool[pool.id] || []
      const requiredPickCount = Number(pool.pick_count || 0)
      if (poolEntries.length === 0 || requiredPickCount <= 0) return null
      const incompleteEntries = poolEntries
        .map(entry => {
          const submittedPickCount = Array.isArray(entry.golfer_picks) ? entry.golfer_picks.length : 0
          if (submittedPickCount >= requiredPickCount) return null
          return {
            id: entry.id,
            displayName: entry.display_name?.trim() || 'Unnamed entry',
            submittedPickCount,
            requiredPickCount,
          }
        })
        .filter((entry): entry is { id: string; displayName: string; submittedPickCount: number; requiredPickCount: number } => Boolean(entry))
      if (incompleteEntries.length === 0) return null
      return {
        id: pool.id,
        name: pool.name,
        incompleteCount: incompleteEntries.length,
        activeEntryCount: poolEntries.length,
        incompleteEntries,
      }
    })
    .filter((pool): pool is RunnerReminderPool => Boolean(pool))
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [incompletePickReminders, fullNamePromptData] = await Promise.all([
    getRunnerIncompletePickReminders(),
    getFullNamePromptData(),
  ])

  return (
    <div className="min-h-screen scorecard-paper text-[#1f2a24]">
      <AppHeader />
      <main className="mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-5 md:px-8 md:py-10">{children}</main>
      {fullNamePromptData && fullNamePromptData.entries.length > 0 ? <FullNameConfirmationPrompt {...fullNamePromptData} /> : null}
      <RunnerIncompletePicksReminder pools={incompletePickReminders} />
      <footer className="border-t border-[#d8cab0] bg-[#fbf7ed] px-5 py-5 text-center text-sm text-[#657168]">
        <div>
          <Link href="/rules" className="font-semibold hover:text-[#123c2f]">Rules</Link>
          <span className="mx-3">/</span>
          <Link href="/blog?from=dashboard" className="font-semibold hover:text-[#123c2f]">Pick Guides</Link>
          <span className="mx-3">/</span>
          <Link href="/help" className="font-semibold hover:text-[#123c2f]">Help</Link>
          <span className="mx-3">/</span>
          <Link href="/privacy" className="font-semibold hover:text-[#123c2f]">Privacy Policy</Link>
          <span className="mx-3">/</span>
          <Link href="/terms" className="font-semibold hover:text-[#123c2f]">Terms</Link>
        </div>
        <p className="mt-3 text-xs">© {new Date().getFullYear()} Golf Pools Pro. All rights reserved.</p>
      </footer>
    </div>
  )
}
