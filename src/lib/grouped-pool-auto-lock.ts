import type { SupabaseClient } from '@supabase/supabase-js'
import type { GolfPlayer } from './golf-api'
import { easternNowParts, shouldAutoFinalizeGroups } from './grouped-pool-auto-lock-timing'
import { findPgaTourTournament, getPgaTourFieldWithMeta, getPgaTourSchedule } from './pga-tour-field'
import { buildPickGroups, type PoolGameFormat } from './pool-formats'
import { hydrateFieldWithOwgr } from './owgr'
import { isFieldAcceptableForLock, fieldFingerprint } from './field-quality'

type AutoLockTournament = {
  id: string
  external_id?: string | null
  name?: string | null
  start_date?: string | null
  field_json?: unknown
  leaderboard_json?: unknown
  last_field_fetch?: string | null
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
  skippedBadField: number
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
  if (!tournament?.name || !tournament.start_date) return { players: [], lastUpdated: null }
  const season = Number(tournament.start_date.slice(0, 4)) || new Date().getFullYear()
  const schedule = await getPgaTourSchedule(season).catch(() => [])
  const match = findPgaTourTournament({
    pgaSchedule: schedule,
    eventName: tournament.name,
    startDate: tournament.start_date,
  })
  if (!match?.tournamentId) return { players: [], lastUpdated: null }
  return getPgaTourFieldWithMeta(match.tournamentId).catch(() => ({ players: [], lastUpdated: null }))
}

export async function autoFinalizeGroupedPools(supabase: SupabaseClient<any>, options: { now?: Date } = {}): Promise<AutoFinalizeGroupedPoolsResult> {
  const now = easternNowParts(options.now || new Date())
  const result: AutoFinalizeGroupedPoolsResult = {
    checked: 0,
    finalized: 0,
    skippedNotDue: 0,
    skippedNoField: 0,
    skippedBadField: 0,
    skippedNoGroups: 0,
  }

  const { data: pools, error } = await supabase
    .from('gpp_pools')
    .select('id, passcode, tournament_id, game_format, group_count, pick_groups_json, groups_finalized_at, gpp_tournaments(id, external_id, name, start_date, field_json, leaderboard_json, last_field_fetch)')
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

    // Always fetch the freshest field before we lock groups. Withdrawals happen
    // between initial field release and Tuesday lock date. Don't trust a stale
    // stored field_json that might still contain WD players.
    const fresh = await fetchEarlyField(tournament)
    let fieldSnapshot: GolfPlayer[] = fresh.players
    let fieldSource: 'pga_tour' | 'stored' = 'pga_tour'
    let lastUpdated: string | null = fresh.lastUpdated

    if (fieldSnapshot.length > 0 && tournament?.id) {
      // Persist the fresh field so the live leaderboard sync later sees the
      // corrected roster and WD statuses.
      await supabase.from('gpp_tournaments').update({
        field_json: fieldSnapshot,
        field_fingerprint: fieldFingerprint(fieldSnapshot),
        field_source: 'pga_tour',
        last_field_fetch: lastUpdated || new Date().toISOString(),
      }).eq('id', tournament.id)
    }

    // Fallback to stored field only when the API is uncooperative.
    if (fieldSnapshot.length === 0) {
      fieldSnapshot = storedField(tournament)
      fieldSource = 'stored'
      lastUpdated = tournament?.last_field_fetch || null
    }

    if (fieldSnapshot.length === 0) {
      result.skippedNoField++
      continue
    }

    // Quality gate: reject stale/cached ESPN placeholder fields before
    // we try to build groups. PGA Tour fields are trusted; stored fields
    // run a lighter sanity check.
    const quality = isFieldAcceptableForLock(fieldSnapshot, {
      source: fieldSource,
      lastUpdated,
      tournamentName: tournament?.name,
    })
    if (!quality.ok) {
      console.warn(`[autoLock] Field failed quality gate for ${tournament?.name || pool.id}: ${quality.reason} (source=${fieldSource})`)
      result.skippedBadField++
      continue
    }

    const hydratedField = await hydrateFieldWithOwgr(fieldSnapshot)

    // buildPickGroups already drops WD players, but double-filter here so the
    // auto-lock result is never polluted by confirmed withdrawals.
    const cleanField = hydratedField.filter(
      (p) => String(p?.status).toLowerCase() !== 'wd'
    )

    const groups = buildPickGroups({
      field: cleanField,
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
