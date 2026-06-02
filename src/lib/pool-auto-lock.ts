import type { SupabaseClient } from '@supabase/supabase-js'
import { todayDateOnly } from './date-utils'
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
  if (status === 'live' || status === 'completed') return true

  const firstTee = firstTeeTimeFromField(tournament.field_json)
  if (firstTee) {
    return now.getTime() >= firstTee.getTime() - PICK_LOCK_BEFORE_FIRST_TEE_MS
  }

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

export async function autoLockPools(supabase: SupabaseClient<any>, options: { now?: Date } = {}): Promise<AutoLockPoolsResult> {
  const now = options.now || new Date()
  const today = todayDateOnly('America/New_York', now)
  const result: AutoLockPoolsResult = {
    checked: 0,
    locked: 0,
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
  return result
}
