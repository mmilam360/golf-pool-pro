import type { SupabaseClient } from '@supabase/supabase-js'
import type { GolfPlayer } from './golf-api'
import { easternNowParts, shouldAutoFinalizeGroups } from './grouped-pool-auto-lock-timing'
import { findPgaTourTournament, getPgaTourField, getPgaTourSchedule } from './pga-tour-field'
import { buildPickGroups, type PoolGameFormat } from './pool-formats'
import { hydrateFieldWithOwgr } from './owgr'

type AutoLockTournament = {
  id: string
  external_id?: string | null
  name?: string | null
  start_date?: string | null
  field_json?: unknown
  leaderboard_json?: unknown
}

type AutoLockPool = {
  id: string
  passcode?: string | null
  tournament_id?: string | null
  game_format: PoolGameFormat
  group_count?: number | null
  pick_groups_json?: unknown
  groups_finalized_at?: string | null
  gpp_tournaments?: AutoLockTournament | AutoLockTournament[] | null
}

export type AutoFinalizeGroupedPoolsResult = {
  checked: number
  finalized: number
  skippedNotDue: number
  skippedNoField: number
  skippedNoGroups: number
}

function getTournament(value: AutoLockPool['gpp_tournaments']) {
  return Array.isArray(value) ? value[0] || null : value || null
}

function storedField(tournament: AutoLockTournament | null) {
  if (Array.isArray(tournament?.field_json) && tournament.field_json.length > 0) return tournament.field_json as GolfPlayer[]
  if (Array.isArray(tournament?.leaderboard_json) && tournament.leaderboard_json.length > 0) return tournament.leaderboard_json as GolfPlayer[]
  return []
}

async function fetchEarlyField(tournament: AutoLockTournament | null) {
  if (!tournament?.name || !tournament.start_date) return []
  const season = Number(tournament.start_date.slice(0, 4)) || new Date().getFullYear()
  const schedule = await getPgaTourSchedule(season).catch(() => [])
  const match = findPgaTourTournament({
    pgaSchedule: schedule,
    eventName: tournament.name,
    startDate: tournament.start_date,
  })
  if (!match?.tournamentId) return []
  return getPgaTourField(match.tournamentId).catch(() => [])
}

export async function autoFinalizeGroupedPools(supabase: SupabaseClient<any>, options: { now?: Date } = {}): Promise<AutoFinalizeGroupedPoolsResult> {
  const now = easternNowParts(options.now || new Date())
  const result: AutoFinalizeGroupedPoolsResult = {
    checked: 0,
    finalized: 0,
    skippedNotDue: 0,
    skippedNoField: 0,
    skippedNoGroups: 0,
  }

  const { data: pools, error } = await supabase
    .from('gpp_pools')
    .select('id, passcode, tournament_id, game_format, group_count, pick_groups_json, groups_finalized_at, gpp_tournaments(id, external_id, name, start_date, field_json, leaderboard_json)')
    .in('game_format', ['ranked_groups', 'random_groups'])
    .is('groups_finalized_at', null)
    .limit(500)

  if (error) throw error

  for (const pool of (pools || []) as AutoLockPool[]) {
    result.checked++
    const tournament = getTournament(pool.gpp_tournaments)
    if (!shouldAutoFinalizeGroups(tournament?.start_date, now)) {
      result.skippedNotDue++
      continue
    }

    let fieldSnapshot = storedField(tournament)
    if (fieldSnapshot.length === 0) {
      fieldSnapshot = await fetchEarlyField(tournament)
      if (fieldSnapshot.length > 0 && tournament?.id) {
        await supabase.from('gpp_tournaments').update({ field_json: fieldSnapshot }).eq('id', tournament.id)
      }
    }

    if (fieldSnapshot.length === 0) {
      result.skippedNoField++
      continue
    }

    fieldSnapshot = await hydrateFieldWithOwgr(fieldSnapshot)

    const groups = buildPickGroups({
      field: fieldSnapshot,
      format: pool.game_format,
      groupCount: Number(pool.group_count || 6),
      seed: `${pool.tournament_id || tournament?.id || ''}:${pool.passcode || pool.id}:${pool.game_format}`,
    })

    if (groups.length === 0) {
      result.skippedNoGroups++
      continue
    }

    const { error: updateError } = await supabase
      .from('gpp_pools')
      .update({
        pick_groups_json: groups,
        field_snapshot_json: fieldSnapshot,
        groups_finalized_at: new Date().toISOString(),
      })
      .eq('id', pool.id)
      .is('groups_finalized_at', null)

    if (updateError) throw updateError
    result.finalized++
  }

  return result
}
