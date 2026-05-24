import { createClient } from '@supabase/supabase-js'
import { getLeaderboard, getSchedule, inferInactiveStatusesFromRounds, mapCompetitorToPlayer } from './golf-api'
import { autoFinalizeGroupedPools } from './grouped-pool-auto-lock'
import { findPgaTourTournament, getPgaTourField, getPgaTourSchedule } from './pga-tour-field'

const ESPN_SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard'

export interface TournamentSyncResult {
  season: number
  fetched: number
  inserted: number
  updated: number
  fieldsUpdated: number
  leaderboardsUpdated: number
  poolsAutoLocked: number
  groupedPoolsAutoFinalized: number
}

function toDateOnly(value: string | null | undefined) {
  return value?.split('T')[0] || value || null
}

function getStatus(event: any) {
  if (event.status === 'live' || event.status === 'completed') return event.status

  const state = event.status?.type?.state || event.competitions?.[0]?.status?.type?.state
  const name = event.status?.type?.name || event.competitions?.[0]?.status?.type?.name
  if (state === 'in' || name === 'STATUS_IN_PROGRESS') return 'live'
  if (state === 'post' || name === 'STATUS_FINAL') return 'completed'

  const endDate = new Date(event.endDate || event.date)
  return endDate < new Date() ? 'completed' : 'upcoming'
}

function extractPlayers(event: any) {
  const competitors = event.competitions?.[0]?.competitors || []
  const round = event.status?.period || event.competitions?.[0]?.status?.period
  return inferInactiveStatusesFromRounds(competitors.map(mapCompetitorToPlayer), round).filter((player: any) => player.name && player.name !== 'Unknown')
}

function finalRoundLooksComplete(players: any[], round?: number | null) {
  if (Number(round || 0) < 4) return false
  const activePlayers = players.filter(player => player?.status === 'active')
  if (activePlayers.length === 0) return false
  return activePlayers.every(player => {
    if (String(player?.thru || '').toUpperCase() === 'F') return true
    const finalRound = Array.isArray(player?.roundScores)
      ? player.roundScores.find((score: any) => Number(score?.round) === Number(round))
      : null
    return Boolean(finalRound?.complete)
  })
}

function completedStatusFromFinalRound(status: string, players: any[], round?: number | null) {
  if (status !== 'live') return status
  return finalRoundLooksComplete(players, round) ? 'completed' : status
}

function normalizePlayerKey(player: any) {
  return String(player?.id || player?.name || `${player?.firstName || ''} ${player?.lastName || ''}`.trim()).trim().toLowerCase()
}

function inactiveStatusLabel(status: string) {
  return status === 'wd' ? 'WD' : status === 'dnq' ? 'DNQ' : 'CUT'
}

function preserveStoredInactiveStatuses(newPlayers: any[], oldPlayers: any[] | null | undefined) {
  if (!Array.isArray(newPlayers) || !Array.isArray(oldPlayers) || oldPlayers.length === 0) return newPlayers
  const oldByKey = new Map<string, any>()
  for (const oldPlayer of oldPlayers) {
    const key = normalizePlayerKey(oldPlayer)
    if (key) oldByKey.set(key, oldPlayer)
  }
  return newPlayers.map(player => {
    const oldPlayer = oldByKey.get(normalizePlayerKey(player))
    const oldStatus = String(oldPlayer?.status || '').toLowerCase()
    const newStatus = String(player?.status || '').toLowerCase()
    if (!['cut', 'wd', 'dnq'].includes(oldStatus) || newStatus !== 'active') return player
    const label = inactiveStatusLabel(oldStatus)
    return {
      ...player,
      status: oldStatus,
      thru: '',
      roundScore: '',
      position: label,
      score: oldStatus === 'cut' ? player.score : label,
    }
  })
}

async function fetchScoreboardEvents() {
  const res = await fetch(ESPN_SCOREBOARD_URL, { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json()
  return data.events || []
}

function rowFromEvent(event: any, season: number) {
  const startDate = toDateOnly(event.date)
  const endDate = toDateOnly(event.endDate || event.date)
  const course = event.courses?.find?.((course: any) => course.host)?.name
    || event.courses?.[0]?.name
    || event.venue?.fullName
    || null
  const location = event.courses?.[0]?.address?.city
    || event.venue?.address?.city
    || null
  const status = getStatus(event)
  const players = extractPlayers(event)

  if (!startDate || !endDate) return null

  const row: Record<string, any> = {
    external_id: String(event.id),
    name: event.name,
    start_date: startDate,
    end_date: endDate,
    season,
    tour: 'pga',
    status,
  }

  if (course) row.course = course
  if (location) row.location = location

  return {
    row,
    players,
    status,
  }
}

async function syncLiveFromScoreboard(supabase: any, season: number): Promise<TournamentSyncResult> {
  const scoreboardEvents = await fetchScoreboardEvents()
  const result: TournamentSyncResult = {
    season,
    fetched: scoreboardEvents.length,
    inserted: 0,
    updated: 0,
    fieldsUpdated: 0,
    leaderboardsUpdated: 0,
    poolsAutoLocked: 0,
    groupedPoolsAutoFinalized: 0,
  }

  const liveTournamentIds: string[] = []

  for (const event of scoreboardEvents) {
    const normalized = rowFromEvent(event, season)
    if (!normalized) continue

    const { row, players, status } = normalized
    const liveLeaderboard = status === 'live' ? await getLeaderboard(row.external_id).catch(() => null) : null
    const playersForStorage = liveLeaderboard?.leaderboard?.length ? liveLeaderboard.leaderboard : players
    const effectiveStatus = completedStatusFromFinalRound(status, playersForStorage, liveLeaderboard?.round || event.status?.period || event.competitions?.[0]?.status?.period)
    row.status = effectiveStatus

    if (playersForStorage.length > 0) {
      row.field_json = playersForStorage
      result.fieldsUpdated++
    }

    if ((effectiveStatus === 'live' || effectiveStatus === 'completed') && playersForStorage.length > 0) {
      row.leaderboard_json = playersForStorage
      row.last_scores_fetch = new Date().toISOString()
      result.leaderboardsUpdated++
    }

    const { data: existing, error: existingError } = await supabase
      .from('gpp_tournaments')
      .select('id, status, leaderboard_json, field_json')
      .eq('external_id', row.external_id)
      .maybeSingle()

    if (existingError) throw existingError

    if (existing) {
      const hasStoredFinalBoard = String(existing.status || '').toLowerCase() === 'completed'
        && effectiveStatus === 'completed'
        && Array.isArray(existing.leaderboard_json)
        && existing.leaderboard_json.length > 0

      if (hasStoredFinalBoard) {
        delete row.leaderboard_json
        delete row.field_json
        delete row.last_scores_fetch
      }

      if (!hasStoredFinalBoard && Array.isArray(row.field_json)) {
        row.field_json = preserveStoredInactiveStatuses(row.field_json, existing.field_json)
      }
      if (!hasStoredFinalBoard && Array.isArray(row.leaderboard_json)) {
        row.leaderboard_json = preserveStoredInactiveStatuses(row.leaderboard_json, existing.leaderboard_json)
      }
      const { error } = await supabase.from('gpp_tournaments').update(row).eq('id', existing.id)
      if (error) throw error
      result.updated++
      if (effectiveStatus === 'live' || effectiveStatus === 'completed') liveTournamentIds.push(existing.id)
    } else {
      const { data: inserted, error } = await supabase.from('gpp_tournaments').insert(row).select('id').single()
      if (error) throw error
      result.inserted++
      if ((effectiveStatus === 'live' || effectiveStatus === 'completed') && inserted?.id) liveTournamentIds.push(inserted.id)
    }
  }

  if (liveTournamentIds.length > 0) {
    const uniqueLiveTournamentIds = Array.from(new Set(liveTournamentIds))
    const { data: lockedPools, error } = await supabase
      .from('gpp_pools')
      .update({ is_locked: true })
      .in('tournament_id', uniqueLiveTournamentIds)
      .eq('is_locked', false)
      .select('id')

    if (error) throw error
    result.poolsAutoLocked = lockedPools?.length || 0
  }

  const groupFinalization = await autoFinalizeGroupedPools(supabase)
  result.groupedPoolsAutoFinalized = groupFinalization.finalized

  return result
}

export async function syncTournaments({
  season = new Date().getFullYear(),
  doLive = false,
}: {
  season?: number
  doLive?: boolean
} = {}): Promise<TournamentSyncResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  if (doLive) return syncLiveFromScoreboard(supabase, season)

  const schedule = await getSchedule(season)
  const scoreboardEvents = await fetchScoreboardEvents()
  const scoreboardById = new Map(scoreboardEvents.map((event: any) => [String(event.id), event]))
  const pgaTourSchedule = await getPgaTourSchedule(season).catch(() => [])

  const result: TournamentSyncResult = {
    season,
    fetched: schedule.length,
    inserted: 0,
    updated: 0,
    fieldsUpdated: 0,
    leaderboardsUpdated: 0,
    poolsAutoLocked: 0,
    groupedPoolsAutoFinalized: 0,
  }

  const liveTournamentIds: string[] = []

  for (const event of schedule) {
    const externalId = String(event.id)
    const scoreboardEvent = scoreboardById.get(externalId)
    const bestEvent: any = scoreboardEvent || event
    const startDate = toDateOnly(bestEvent.date || event.date)
    const endDate = toDateOnly(bestEvent.endDate || event.endDate || event.date)
    const course = bestEvent.courses?.find?.((course: any) => course.host)?.name
      || bestEvent.courses?.[0]?.name
      || bestEvent.venue?.fullName
      || event.venue?.fullName
      || null
    const location = bestEvent.courses?.[0]?.address?.city
      || bestEvent.venue?.address?.city
      || null
    const status = getStatus(bestEvent)
    let players = extractPlayers(bestEvent)
    if (players.length === 0 && status === 'upcoming') {
      const pgaTourTournament = findPgaTourTournament({
        pgaSchedule: pgaTourSchedule,
        eventName: bestEvent.name || event.name,
        startDate,
      })
      if (pgaTourTournament?.tournamentId) {
        const earlyField = await getPgaTourField(pgaTourTournament.tournamentId).catch(() => [])
        if (earlyField.length > 0) players = earlyField
      }
    }

    if (!startDate || !endDate) continue

    const { data: existing, error: existingError } = await supabase
      .from('gpp_tournaments')
      .select('id, status, leaderboard_json, field_json')
      .eq('external_id', externalId)
      .maybeSingle()

    if (existingError) throw existingError

    const row: Record<string, any> = {
      external_id: externalId,
      name: bestEvent.name || event.name,
      start_date: startDate,
      end_date: endDate,
      course,
      location,
      season,
      tour: 'pga',
      status,
    }

    // ESPN often has the event before the field. Once competitors appear,
    // replace the cached field every sync so late adds/WDs update before start.
    // If ESPN temporarily returns zero competitors, do not erase the prior field.
    if (players.length > 0) {
      row.field_json = players
      result.fieldsUpdated++
    }

    let leaderboardPlayers: any[] | null = null
    let leaderboardRound: number | null = null
    if (doLive && status === 'live') {
      const leaderboard = await getLeaderboard(externalId).catch(() => null)
      if (leaderboard?.leaderboard?.length) {
        leaderboardPlayers = leaderboard.leaderboard
        leaderboardRound = leaderboard.round
        row.leaderboard_json = leaderboard.leaderboard
        row.last_scores_fetch = new Date().toISOString()
        result.leaderboardsUpdated++
      }
    }

    const effectiveStatus = completedStatusFromFinalRound(status, leaderboardPlayers || players, leaderboardRound || bestEvent.status?.period || bestEvent.competitions?.[0]?.status?.period)
    row.status = effectiveStatus
    if (effectiveStatus === 'completed' && leaderboardPlayers?.length) {
      row.leaderboard_json = leaderboardPlayers
      row.last_scores_fetch = new Date().toISOString()
    }

    if (existing) {
      const hasStoredFinalBoard = String(existing.status || '').toLowerCase() === 'completed'
        && effectiveStatus === 'completed'
        && Array.isArray(existing.leaderboard_json)
        && existing.leaderboard_json.length > 0

      if (hasStoredFinalBoard) {
        delete row.leaderboard_json
        delete row.field_json
        delete row.last_scores_fetch
      }

      if (!hasStoredFinalBoard && Array.isArray(row.field_json)) {
        row.field_json = preserveStoredInactiveStatuses(row.field_json, existing.field_json)
      }
      if (!hasStoredFinalBoard && Array.isArray(row.leaderboard_json)) {
        row.leaderboard_json = preserveStoredInactiveStatuses(row.leaderboard_json, existing.leaderboard_json)
      }
      const { error } = await supabase.from('gpp_tournaments').update(row).eq('id', existing.id)
      if (error) throw error
      result.updated++
      if (effectiveStatus === 'live' || effectiveStatus === 'completed') liveTournamentIds.push(existing.id)
    } else {
      const { data: inserted, error } = await supabase.from('gpp_tournaments').insert(row).select('id').single()
      if (error) throw error
      result.inserted++
      if ((effectiveStatus === 'live' || effectiveStatus === 'completed') && inserted?.id) liveTournamentIds.push(inserted.id)
    }
  }

  if (liveTournamentIds.length > 0) {
    const uniqueLiveTournamentIds = Array.from(new Set(liveTournamentIds))
    const { data: lockedPools, error } = await supabase
      .from('gpp_pools')
      .update({ is_locked: true })
      .in('tournament_id', uniqueLiveTournamentIds)
      .eq('is_locked', false)
      .select('id')

    if (error) throw error
    result.poolsAutoLocked = lockedPools?.length || 0
  }

  const groupFinalization = await autoFinalizeGroupedPools(supabase)
  result.groupedPoolsAutoFinalized = groupFinalization.finalized

  return result
}
