import type { GolfPlayer } from './golf-api'
import { hydrateFieldWithOwgr } from './owgr'
import { buildPickGroups, type PickGroup, type PoolGameFormat } from './pool-formats'
import {
  fetchTheOddsApiTournamentOdds,
  parseTournamentOddsSnapshot,
  selectTheOddsApiSportKey,
  type TournamentOddsSnapshot,
} from './tournament-odds'

type TournamentForOdds = {
  id: string
  name: string
  start_date?: string | null
  odds_snapshot_json?: unknown
}

type PoolForGroups = {
  tournament_id?: string | null
  passcode?: string | null
  game_format: PoolGameFormat
  group_count?: number | null
  picks_per_group?: number | null
}

export async function ensureTournamentOddsSnapshot({
  supabase,
  tournament,
  field,
  apiKey = process.env.THE_ODDS_API_KEY,
  fetchImpl = fetch,
  hydrateField = hydrateFieldWithOwgr,
  capturedAt,
  now,
}: {
  supabase: any
  tournament: TournamentForOdds
  field: GolfPlayer[]
  apiKey?: string
  fetchImpl?: typeof fetch
  hydrateField?: typeof hydrateFieldWithOwgr
  capturedAt?: string
  now?: string | Date
}): Promise<TournamentOddsSnapshot | null> {
  const existing = parseTournamentOddsSnapshot(tournament.odds_snapshot_json)
  if (existing?.status === 'ok') return existing
  if (!apiKey || !selectTheOddsApiSportKey(tournament.name)) return null

  const hydratedField = await hydrateField(field)
  const cleanField = hydratedField.filter(player => String(player?.status).toLowerCase() !== 'wd')
  const snapshot = await fetchTheOddsApiTournamentOdds({
    tournamentName: tournament.name,
    tournamentStartDate: tournament.start_date,
    field: cleanField as any[],
    apiKey,
    fetchImpl,
    capturedAt,
    now,
  })

  if (snapshot.status !== 'ok') return snapshot

  const payload = {
    odds_snapshot_json: snapshot,
    odds_source: snapshot.source,
    odds_event_id: snapshot.eventId,
    odds_captured_at: snapshot.capturedAt,
  }
  const { data: saved, error } = await supabase
    .from('gpp_tournaments')
    .update(payload)
    .eq('id', tournament.id)
    .is('odds_snapshot_json', null)
    .select('odds_snapshot_json')
    .maybeSingle()

  if (error) {
    throw new Error(`Could not save tournament odds snapshot: ${error.message}`)
  }

  const savedSnapshot = parseTournamentOddsSnapshot(saved?.odds_snapshot_json)
  if (savedSnapshot?.status === 'ok') return savedSnapshot

  const { data: current, error: readError } = await supabase
    .from('gpp_tournaments')
    .select('odds_snapshot_json')
    .eq('id', tournament.id)
    .maybeSingle()
  if (readError) {
    throw new Error(`Could not read tournament odds snapshot: ${readError.message}`)
  }
  return parseTournamentOddsSnapshot(current?.odds_snapshot_json) || snapshot
}

export async function buildGroupedPickGroupsForLock({
  supabase,
  tournament,
  pool,
  field,
}: {
  supabase: any
  tournament: TournamentForOdds
  pool: PoolForGroups
  field: GolfPlayer[]
}): Promise<{ cleanField: GolfPlayer[]; groups: PickGroup[]; oddsSnapshot: TournamentOddsSnapshot | null }> {
  const hydratedField = await hydrateFieldWithOwgr(field)
  const cleanField = hydratedField.filter(player => String(player?.status).toLowerCase() !== 'wd')
  const oddsSnapshot = pool.game_format === 'ranked_groups'
    ? await ensureTournamentOddsSnapshot({
      supabase,
      tournament,
      field: cleanField,
      hydrateField: async players => players,
    })
    : null
  const groups = buildPickGroups({
    field: cleanField,
    format: pool.game_format,
    groupCount: Number(pool.group_count || 6),
    seed: `${pool.tournament_id || tournament.id}:${pool.passcode || ''}:${pool.game_format}`,
    oddsSnapshot,
    picksPerGroup: Number(pool.picks_per_group || 1),
  })

  return { cleanField, groups, oddsSnapshot }
}
