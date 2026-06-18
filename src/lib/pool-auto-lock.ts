import type { SupabaseClient } from '@supabase/supabase-js'
import { todayDateOnly } from './date-utils'
import { emptyEntryIdsForAutoRemoval, type EntryPickFields } from './entry-picks'
import type { PoolGameFormat } from './pool-formats'

const PICK_LOCK_BEFORE_FIRST_TEE_MS = 5 * 60 * 1000

type LockPoolTournament = {
  id: string
  name?: string | null
  start_date?: string | null
  status?: string | null
  field_json?: Array<{ teeTime?: string | null }> | null
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
  emptyEntriesAutoRemoved: number
  skippedNotDue: number
  skippedGroupsPending: number
}

function getTournament(value: LockPool['gpp_tournaments']) {
  return Array.isArray(value) ? value[0] || null : value || null
}

export function firstTeeTimeFromField(field: LockPoolTournament['field_json']) {
  if (!Array.isArray(field)) return null
  let firstTee: Date | null = null
  for (const player of field) {
    if (!player?.teeTime) continue
    const teeTime = new Date(player.teeTime)
    if (!Number.isFinite(teeTime.getTime())) continue
    if (!firstTee || teeTime.getTime() < firstTee.getTime()) firstTee = teeTime
  }
  return firstTee
}

export function tournamentIsDueToLock(tournament: LockPoolTournament | null, today: string, now = new Date()) {
  if (!tournament) return false
  const status = String(tournament.status || '').toLowerCase()

  const firstTee = firstTeeTimeFromField(tournament.field_json)
  if (firstTee) {
    return now.getTime() >= firstTee.getTime() - PICK_LOCK_BEFORE_FIRST_TEE_MS
  }

  if (status === 'live' || status === 'completed') return true

  return Boolean(tournament.start_date && tournament.start_date <= today)
}

export function tournamentIsInLiveActivationWindow(tournament: LockPoolTournament | null, now = new Date()) {
  if (!tournament) return false
  const status = String(tournament.status || '').toLowerCase()
  if (status === 'live') return true
  if (status !== 'upcoming') return false

  const firstTee = firstTeeTimeFromField(tournament.field_json)
  if (!firstTee) return false
  return now.getTime() >= firstTee.getTime() - PICK_LOCK_BEFORE_FIRST_TEE_MS
}

export function groupsAreReady(pool: LockPool) {
  return pool.game_format === 'standard' || Boolean(pool.groups_finalized_at)
}

async function autoRemoveEmptyEntriesForPools(supabase: SupabaseClient<any>, poolIds: string[], now: Date) {
  if (poolIds.length === 0) return 0

  const { data: lockedPools, error: poolError } = await supabase
    .from('gpp_pools')
    .select('id')
    .in('id', poolIds)
    .eq('is_locked', true)

  if (poolError) throw poolError
  const lockedPoolIds = (lockedPools || []).map((pool: { id: string }) => pool.id)
  if (lockedPoolIds.length === 0) return 0

  const { data: entries, error } = await supabase
    .from('gpp_entries')
    .select('id, golfer_picks')
    .in('pool_id', lockedPoolIds)
    .eq('is_removed', false)

  if (error) throw error

  const emptyEntryIds = emptyEntryIdsForAutoRemoval((entries || []) as EntryPickFields[])
  if (emptyEntryIds.length === 0) return 0

  const { data: removedEntries, error: updateError } = await supabase
    .from('gpp_entries')
    .update({ is_removed: true, removed_reason: 'No picks submitted', removed_at: now.toISOString() })
    .in('id', emptyEntryIds)
    .eq('is_removed', false)
    .select('id')

  if (updateError) throw updateError
  return removedEntries?.length || 0
}

export async function autoLockPools(supabase: SupabaseClient<any>, options: { now?: Date } = {}): Promise<AutoLockPoolsResult> {
  const now = options.now || new Date()
  const today = todayDateOnly('America/New_York', now)
  const result: AutoLockPoolsResult = {
    checked: 0,
    locked: 0,
    emptyEntriesAutoRemoved: 0,
    skippedNotDue: 0,
    skippedGroupsPending: 0,
  }

  const { data: pools, error } = await supabase
    .from('gpp_pools')
    .select('id, game_format, groups_finalized_at, gpp_tournaments(id, name, start_date, status, field_json)')
    .eq('is_locked', false)
    .eq('is_completed', false)
    .limit(1000)

  if (error) throw error

  const dueIds: string[] = []
  for (const pool of (pools || []) as LockPool[]) {
    result.checked++
    const tournament = getTournament(pool.gpp_tournaments)
    if (!tournamentIsDueToLock(tournament, today, now)) {
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
    .update({ is_locked: true, lock_at: now.toISOString() })
    .in('id', dueIds)
    .eq('is_locked', false)
    .select('id')

  if (updateError) throw updateError
  result.locked = lockedPools?.length || 0
  result.emptyEntriesAutoRemoved = await autoRemoveEmptyEntriesForPools(
    supabase,
    (lockedPools || []).map((pool: { id: string }) => pool.id),
    now,
  )
  return result
}
