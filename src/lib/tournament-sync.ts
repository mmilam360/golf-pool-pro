import { createClient } from '@supabase/supabase-js'
import { getLeaderboard, getSchedule, mapCompetitorToPlayer } from './golf-api'

const ESPN_SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard'

export interface TournamentSyncResult {
  season: number
  fetched: number
  inserted: number
  updated: number
  fieldsUpdated: number
  leaderboardsUpdated: number
  poolsAutoLocked: number
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
  return competitors.map(mapCompetitorToPlayer).filter((player: any) => player.name && player.name !== 'Unknown')
}

async function fetchScoreboardEvents() {
  const res = await fetch(ESPN_SCOREBOARD_URL)
  if (!res.ok) return []
  const data = await res.json()
  return data.events || []
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
  const schedule = await getSchedule(season)
  const scoreboardEvents = await fetchScoreboardEvents()
  const scoreboardById = new Map(scoreboardEvents.map((event: any) => [String(event.id), event]))

  const result: TournamentSyncResult = {
    season,
    fetched: schedule.length,
    inserted: 0,
    updated: 0,
    fieldsUpdated: 0,
    leaderboardsUpdated: 0,
    poolsAutoLocked: 0,
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
    const players = extractPlayers(bestEvent)

    if (!startDate || !endDate) continue

    const { data: existing, error: existingError } = await supabase
      .from('gpp_tournaments')
      .select('id')
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

    if (doLive && status === 'live') {
      const leaderboard = await getLeaderboard(externalId).catch(() => null)
      if (leaderboard?.leaderboard?.length) {
        row.leaderboard_json = leaderboard.leaderboard
        row.last_scores_fetch = new Date().toISOString()
        result.leaderboardsUpdated++
      }
    }

    if (existing) {
      const { error } = await supabase.from('gpp_tournaments').update(row).eq('id', existing.id)
      if (error) throw error
      result.updated++
      if (status === 'live' || status === 'completed') liveTournamentIds.push(existing.id)
    } else {
      const { data: inserted, error } = await supabase.from('gpp_tournaments').insert(row).select('id').single()
      if (error) throw error
      result.inserted++
      if ((status === 'live' || status === 'completed') && inserted?.id) liveTournamentIds.push(inserted.id)
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

  return result
}
