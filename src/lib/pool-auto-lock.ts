import type { SupabaseClient } from '@supabase/supabase-js'
import { todayDateOnly } from './date-utils'
import type { PoolGameFormat } from './pool-formats'

type LockPoolTournament = {
  id: string
  name?: string | null
  start_date?: string | null
  status?: string | null
}

type LockPool = {
  id: string
  game_format?: PoolGameFormat | null
  groups_finalized_at?: string | null
  gpp_tournaments?: LockPoolTournament | LockPoolTournament[] | null
}

export type AutoLockPoolsResult = {
  checked: number
  locked: number
  skippedNotDue: number
  skippedGroupsPending: number
}

function getTournament(value: LockPool['gpp_tournaments']) {
  return Array.isArray(value) ? value[0] || null : value || null
}

export function tournamentIsDueToLock(tournament: LockPoolTournament | null, today: string) {
  if (!tournament) return false
  const status = String(tournament.status || '').toLowerCase()
  if (status === 'live' || status === 'completed') return true
  return Boolean(tournament.start_date && tournament.start_date <= today)
}

export function groupsAreReady(pool: LockPool) {
  return pool.game_format === 'standard' || Boolean(pool.groups_finalized_at)
}

export async function autoLockPools(supabase: SupabaseClient<any>, options: { now?: Date } = {}): Promise<AutoLockPoolsResult> {
  const today = todayDateOnly('America/New_York', options.now || new Date())
  const result: AutoLockPoolsResult = {
    checked: 0,
    locked: 0,
    skippedNotDue: 0,
    skippedGroupsPending: 0,
  }

  const { data: pools, error } = await supabase
    .from('gpp_pools')
    .select('id, game_format, groups_finalized_at, gpp_tournaments(id, name, start_date, status)')
    .eq('is_locked', false)
    .eq('is_completed', false)
    .limit(1000)

  if (error) throw error

  const dueIds: string[] = []
  for (const pool of (pools || []) as LockPool[]) {
    result.checked++
    const tournament = getTournament(pool.gpp_tournaments)
    if (!tournamentIsDueToLock(tournament, today)) {
      result.skippedNotDue++
      continue
    }
    if (!groupsAreReady(pool)) {
      result.skippedGroupsPending++
      continue
    }
    dueIds.push(pool.id)
  }

  if (dueIds.length === 0) return result

  const { data: lockedPools, error: updateError } = await supabase
    .from('gpp_pools')
    .update({ is_locked: true, lock_at: new Date().toISOString() })
    .in('id', dueIds)
    .eq('is_locked', false)
    .select('id')

  if (updateError) throw updateError
  result.locked = lockedPools?.length || 0
  return result
}
