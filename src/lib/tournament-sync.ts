import { createClient } from '@supabase/supabase-js'
import { getLeaderboard, getSchedule, inferInactiveStatusesFromRounds, mapCompetitorToPlayer, enrichPlayersWithTeeTimes, enrichPlayersWithFirstRoundTeeTimes } from './golf-api'
import { autoFinalizeGroupedPools } from './grouped-pool-auto-lock'
import { findPgaTourTournament, getPgaTourFieldWithMeta, getPgaTourSchedule } from './pga-tour-field'
import { fieldFingerprint, looksLikePlaceholderField, recordFieldFetchAttempt, shouldAlertOnFieldFailures } from './field-quality'
import { notificationPrefsAllow, recordNotificationEvent, sendPushToUser } from './notifications/push'

const ESPN_SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard'
const ESPN_EVENT_URL = (eventId: string) => `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?event=${eventId}`

export interface TournamentSyncResult {
  season: number
  fetched: number
  inserted: number
  updated: number
  fieldsUpdated: number
  fieldsRejected: number
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

async function fetchEventSpecificField(eventId: string) {
  try {
    const res = await fetch(ESPN_EVENT_URL(eventId), { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    const event = (data.events || [])[0]
    if (!event) return []
    const competition = event.competitions?.[0]
    const rawPlayers = (competition?.competitors || []).map(mapCompetitorToPlayer)
    const players = await enrichPlayersWithTeeTimes(eventId, String(competition?.id || eventId), rawPlayers)
    return players
  } catch {
    return []
  }
}

async function loadExistingFingerprints(supabase: any): Promise<Map<string, string[]>> {
  const { data } = await supabase
    .from('gpp_tournaments')
    .select('id, field_fingerprint')
    .not('field_fingerprint', 'is', null)
    .limit(500)
  const map = new Map<string, string[]>()
  for (const row of data || []) {
    const ids = map.get(row.field_fingerprint) || []
    ids.push(row.id)
    map.set(row.field_fingerprint, ids)
  }
  return map
}

async function fieldUpdatePushAllowed(supabase: any, userId: string) {
  const { data } = await supabase
    .from('gpp_notification_preferences')
    .select('field_update')
    .eq('user_id', userId)
    .maybeSingle()
  return notificationPrefsAllow(data, 'field_update')
}

async function recordFieldUpdateAlert(params: {
  supabase: any
  userId?: string | null
  poolId: string
  dedupeKey: string
  title: string
  body: string
  payload: Record<string, unknown>
}) {
  if (!params.userId) return
  const inserted = await recordNotificationEvent({
    userId: params.userId,
    poolId: params.poolId,
    type: 'field_update',
    dedupeKey: params.dedupeKey,
    payload: params.payload,
  })
  if (!inserted) return
  if (!await fieldUpdatePushAllowed(params.supabase, params.userId)) return
  await sendPushToUser(params.userId, {
    title: params.title,
    body: params.body,
    url: `/pool/${params.poolId}#make-picks`,
    tag: params.dedupeKey,
  })
}

async function pruneOpenStandardPoolPicksForTournament(supabase: any, tournamentId: string, players: any[]) {
  if (!Array.isArray(players) || players.length === 0) return 0
  const validNames = new Set(players.map(player => player?.name).filter(Boolean))
  if (validNames.size === 0) return 0
  const fingerprint = fieldFingerprint(players)

  const { data: tournament } = await supabase
    .from('gpp_tournaments')
    .select('name')
    .eq('id', tournamentId)
    .maybeSingle() as { data: { name?: string } | null }

  const { data: pools, error: poolsError } = await supabase
    .from('gpp_pools')
    .select('id, name, owner_id')
    .eq('tournament_id', tournamentId)
    .eq('game_format', 'standard')
    .eq('is_locked', false)

  if (poolsError) throw poolsError
  const poolIds = (pools || []).map((pool: { id: string }) => pool.id)
  if (poolIds.length === 0) return 0
  const poolById = new Map<string, any>((pools || []).map((pool: any) => [pool.id, pool]))

  const { data: entries, error: entriesError } = await supabase
    .from('gpp_entries')
    .select('id, pool_id, user_id, display_name, golfer_picks')
    .in('pool_id', poolIds)
    .eq('is_removed', false)

  if (entriesError) throw entriesError

  let pruned = 0
  const hostSummaries = new Map<string, { pool: any; affected: Array<{ displayName: string; removed: string[] }> }>()
  for (const entry of entries || []) {
    const picks = Array.isArray(entry.golfer_picks) ? entry.golfer_picks : []
    const removedPicks = picks.filter((name: string) => !validNames.has(name))
    if (removedPicks.length === 0) continue
    const nextPicks = picks.filter((name: string) => validNames.has(name))
    const { error } = await supabase
      .from('gpp_entries')
      .update({ golfer_picks: nextPicks })
      .eq('id', entry.id)
    if (error) throw error
    pruned++

    const pool = poolById.get(entry.pool_id)
    const poolName = pool?.name || 'Your pool'
    const removedCount = removedPicks.length
    await recordFieldUpdateAlert({
      supabase,
      userId: entry.user_id,
      poolId: entry.pool_id,
      dedupeKey: `field_update:entry:${entry.id}:${fingerprint}`,
      title: 'Field changed — update your picks',
      body: `${poolName}: ${removedCount} ${removedCount === 1 ? 'golfer was' : 'golfers were'} removed from the official field. Make replacement picks before lock.`,
      payload: {
        role: 'entrant',
        poolName,
        tournamentName: tournament?.name || null,
        entryId: entry.id,
        entryName: entry.display_name || 'Entry',
        removedPicks,
        removedCount,
        remainingPickCount: nextPicks.length,
      },
    })

    if (pool?.owner_id) {
      const summary = hostSummaries.get(entry.pool_id) || { pool, affected: [] }
      summary.affected.push({ displayName: entry.display_name || 'Entry', removed: removedPicks })
      hostSummaries.set(entry.pool_id, summary)
    }
  }

  for (const [poolId, summary] of hostSummaries.entries()) {
    const affectedCount = summary.affected.length
    const removedCount = summary.affected.reduce((total, entry) => total + entry.removed.length, 0)
    await recordFieldUpdateAlert({
      supabase,
      userId: summary.pool.owner_id,
      poolId,
      dedupeKey: `field_update:host:${poolId}:${fingerprint}`,
      title: 'Field changed in your pool',
      body: `${summary.pool.name}: ${affectedCount} ${affectedCount === 1 ? 'entry needs' : 'entries need'} replacement picks before lock.`,
      payload: {
        role: 'host',
        poolName: summary.pool.name,
        tournamentName: tournament?.name || null,
        affectedEntries: summary.affected,
        affectedCount,
        removedCount,
      },
    })
  }

  return pruned
}

function shouldAcceptField(
  players: any[],
  source: string,
  existingFingerprint: string | null | undefined,
  fingerprintMap: Map<string, string[]>,
  tournamentId: string,
): { ok: boolean; fingerprint: string; message?: string } {
  if (!Array.isArray(players) || players.length === 0) {
    return { ok: false, fingerprint: '', message: 'empty' }
  }
  const fp = fieldFingerprint(players)
  if (existingFingerprint && fp === existingFingerprint) {
    return { ok: true, fingerprint: fp, message: 'same-as-stored' }
  }
  const collisionIds = (fingerprintMap.get(fp) || []).filter((id: string) => id !== tournamentId)
  const check = looksLikePlaceholderField(players, collisionIds)
  if (check.isPlaceholder) {
    console.warn(`[sync] Field rejected for ${tournamentId}: ${check.reason} (source=${source})`)
    return { ok: false, fingerprint: fp, message: check.reason }
  }
  return { ok: true, fingerprint: fp, message: 'pass' }
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

export async function refreshPgaTourFields(supabase: any, season: number): Promise<{ checked: number; refreshed: number; rejected: number; alertsSent: number; failures: Array<{ tournamentId: string; name: string; count: number }> }> {
  const result = { checked: 0, refreshed: 0, rejected: 0, alertsSent: 0, failures: [] as Array<{ tournamentId: string; name: string; count: number }> }
  const pgaTourSchedule = await getPgaTourSchedule(season).catch(() => [])

  const { data: upcomingTournaments, error } = await supabase
    .from('gpp_tournaments')
    .select('id, name, start_date, external_id, field_json, field_fingerprint, last_field_fetch, field_source')
    .eq('status', 'upcoming')
    .order('start_date', { ascending: true })

  if (error) throw error

  const fingerprintMap = await loadExistingFingerprints(supabase)

  for (const t of (upcomingTournaments || [])) {
    result.checked++

    const pgaMatch = findPgaTourTournament({
      pgaSchedule: pgaTourSchedule,
      eventName: t.name,
      startDate: t.start_date,
    })

    if (!pgaMatch?.tournamentId) {
      recordFieldFetchAttempt(t.id, false)
      const alert = shouldAlertOnFieldFailures(t.id)
      if (alert.shouldAlert) {
        result.alertsSent++
        result.failures.push({ tournamentId: t.id, name: t.name || 'Unknown', count: alert.failureCount })
        console.error(`[refreshFields] ALERT: ${t.name} — no PGA Tour match after ${alert.failureCount} attempts`)
      }
      continue
    }

    const fresh = await getPgaTourFieldWithMeta(pgaMatch.tournamentId).catch(() => ({ players: [], lastUpdated: null }))
    if (fresh.players.length === 0) {
      recordFieldFetchAttempt(t.id, false)
      const alert = shouldAlertOnFieldFailures(t.id)
      if (alert.shouldAlert) {
        result.alertsSent++
        result.failures.push({ tournamentId: t.id, name: t.name || 'Unknown', count: alert.failureCount })
        console.error(`[refreshFields] ALERT: ${t.name} — empty field from PGA Tour API after ${alert.failureCount} attempts`)
      }
      continue
    }

    recordFieldFetchAttempt(t.id, true)

    const fp = fieldFingerprint(fresh.players)
    const collisionIds = (fingerprintMap.get(fp) || []).filter((id: string) => id !== t.id)
    const check = looksLikePlaceholderField(fresh.players, collisionIds)

    if (check.isPlaceholder) {
      console.warn(`[refreshFields] Rejected for ${t.name}: ${check.reason}`)
      result.rejected++
      continue
    }

    await supabase.from('gpp_tournaments').update({
      field_json: fresh.players,
      field_fingerprint: fp,
      field_source: 'pga_tour',
      last_field_fetch: fresh.lastUpdated || new Date().toISOString(),
    }).eq('id', t.id)

    await pruneOpenStandardPoolPicksForTournament(supabase, t.id, fresh.players)

    result.refreshed++
  }

  return result
}

async function syncLiveFromScoreboard(supabase: any, season: number): Promise<TournamentSyncResult> {
  const scoreboardEvents = await fetchScoreboardEvents()
  const result: TournamentSyncResult = {
    season,
    fetched: scoreboardEvents.length,
    inserted: 0,
    updated: 0,
    fieldsUpdated: 0,
    fieldsRejected: 0,
    leaderboardsUpdated: 0,
    poolsAutoLocked: 0,
    groupedPoolsAutoFinalized: 0,
  }

  const liveTournamentIds: string[] = []
  const fingerprintMap = await loadExistingFingerprints(supabase)

  for (const event of scoreboardEvents) {
    const normalized = rowFromEvent(event, season)
    if (!normalized) continue

    const { row, players, status } = normalized
    const liveLeaderboard = status === 'live' ? await getLeaderboard(row.external_id).catch(() => null) : null
    let playersForStorage = liveLeaderboard?.leaderboard?.length ? liveLeaderboard.leaderboard : players

    // ESPN general scoreboard often returns zero competitors for pre events.
    // Try the event-specific endpoint before falling back to PGA Tour.
    if (playersForStorage.length === 0 && status === 'upcoming') {
      const eventSpecificPlayers = await fetchEventSpecificField(row.external_id)
      if (eventSpecificPlayers.length > 0) {
        playersForStorage = eventSpecificPlayers
      }
    }

    // ESPN scoreboard strips tee times from competitors. Enrich separately.
    // For upcoming tournaments, fetch first-round (Thursday) tee times.
    // For live tournaments, the regular enrichPlayersWithTeeTimes path handles today's tee times.
    if (playersForStorage.length > 0 && status === 'upcoming' && !playersForStorage.some((p: any) => p.teeTime)) {
      const competition = event.competitions?.[0]
      const enriched = await enrichPlayersWithFirstRoundTeeTimes(row.external_id, String(competition?.id || row.external_id), playersForStorage)
      if (enriched.some((p: any) => p.teeTime)) {
        playersForStorage = enriched
      }
    }

    const effectiveStatus = completedStatusFromFinalRound(status, playersForStorage, liveLeaderboard?.round || event.status?.period || event.competitions?.[0]?.status?.period)
    row.status = effectiveStatus

    // Decide source label used for validation
    const fieldSource = playersForStorage.length > 0 && playersForStorage === players
      ? 'espn_scoreboard'
      : 'espn_event'

    const { data: existing, error: existingError } = await supabase
      .from('gpp_tournaments')
      .select('id, status, leaderboard_json, field_json, field_fingerprint')
      .eq('external_id', row.external_id)
      .maybeSingle()

    if (existingError) throw existingError

    const fieldCheck = shouldAcceptField(
      playersForStorage,
      fieldSource,
      existing?.field_fingerprint,
      fingerprintMap,
      existing?.id || row.external_id,
    )

    if (fieldCheck.ok) {
      row.field_json = playersForStorage
      row.field_fingerprint = fieldCheck.fingerprint
      row.field_source = fieldSource
      row.last_field_fetch = new Date().toISOString()
      result.fieldsUpdated++
    } else if (playersForStorage.length > 0) {
      result.fieldsRejected++
    }

    if ((effectiveStatus === 'live' || effectiveStatus === 'completed') && playersForStorage.length > 0) {
      row.leaderboard_json = playersForStorage
      row.last_scores_fetch = new Date().toISOString()
      result.leaderboardsUpdated++
    }

    // If ESPN returns zero competitors but we already have a stored field, preserve it.
    // Only replace when we found real data.
    if (existing && playersForStorage.length === 0 && Array.isArray(existing.field_json) && existing.field_json.length > 0) {
      delete row.field_json
      delete row.field_fingerprint
      delete row.field_source
      delete row.last_field_fetch
    }

    if (existing) {
      const hasStoredFinalBoard = String(existing.status || '').toLowerCase() === 'completed'
        && effectiveStatus === 'completed'
        && Array.isArray(existing.leaderboard_json)
        && existing.leaderboard_json.length > 0

      if (hasStoredFinalBoard) {
        delete row.leaderboard_json
        delete row.field_json
        delete row.field_fingerprint
        delete row.field_source
        delete row.last_field_fetch
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
      if (Array.isArray(row.field_json)) {
        await pruneOpenStandardPoolPicksForTournament(supabase, existing.id, row.field_json)
      }
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
    // Auto-lock STANDARD pools immediately when a tournament goes live.
    // For grouped pools, only lock if groups have already been finalized.
    // Unfinalized grouped pools should stay open so the Tuesday auto-finalize
    // can set groups first, then Thursday's live status will lock them.
    const { data: lockedPools, error } = await supabase
      .from('gpp_pools')
      .update({ is_locked: true })
      .in('tournament_id', uniqueLiveTournamentIds)
      .eq('is_locked', false)
      .or('game_format.eq.standard,and(game_format.neq.standard,groups_finalized_at.not.is.null)')
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
    fieldsRejected: 0,
    leaderboardsUpdated: 0,
    poolsAutoLocked: 0,
    groupedPoolsAutoFinalized: 0,
  }

  const fingerprintMap = await loadExistingFingerprints(supabase)
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
    let pgaMeta: { players: any[]; lastUpdated: string | null } = { players: [], lastUpdated: null }

    // Prefer PGA Tour field data for upcoming tournaments — it includes OWGR
    // and is available earlier/more completely than ESPN's pre-event field.
    if (status === 'upcoming') {
      const pgaTourTournament = findPgaTourTournament({
        pgaSchedule: pgaTourSchedule,
        eventName: bestEvent.name || event.name,
        startDate,
      })
      if (pgaTourTournament?.tournamentId) {
        pgaMeta = await getPgaTourFieldWithMeta(pgaTourTournament.tournamentId).catch(() => ({ players: [], lastUpdated: null }))
        if (pgaMeta.players.length > 0) players = pgaMeta.players
      }
    }

    // If general scoreboard has no competitors, try event-specific endpoint first.
    if (players.length === 0 && status === 'upcoming') {
      const eventSpecificPlayers = await fetchEventSpecificField(externalId)
      if (eventSpecificPlayers.length > 0) {
        players = eventSpecificPlayers
      } else {
        // Fallback to PGA Tour GraphQL
        const pgaTourTournament = findPgaTourTournament({
          pgaSchedule: pgaTourSchedule,
          eventName: bestEvent.name || event.name,
          startDate,
        })
        if (pgaTourTournament?.tournamentId) {
          pgaMeta = await getPgaTourFieldWithMeta(pgaTourTournament.tournamentId).catch(() => ({ players: [], lastUpdated: null }))
          if (pgaMeta.players.length > 0) players = pgaMeta.players
        }
      }
    }

    if (!startDate || !endDate) continue

    const { data: existing, error: existingError } = await supabase
      .from('gpp_tournaments')
      .select('id, status, leaderboard_json, field_json, field_fingerprint')
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

    // Determine field source and, for PGA Tour upcoming, the lastUpdated timestamp.
    let fieldSource: 'espn_scoreboard' | 'espn_event' | 'pga_tour' = scoreboardEvent ? 'espn_scoreboard' : 'espn_event'
    let lastUpdated: string | null = null
    if (status === 'upcoming' && pgaMeta.players.length > 0) {
      fieldSource = 'pga_tour'
      lastUpdated = pgaMeta.lastUpdated
    }

    const fieldCheck = shouldAcceptField(
      players,
      fieldSource,
      existing?.field_fingerprint,
      fingerprintMap,
      existing?.id || row.external_id,
    )

    if (fieldCheck.ok) {
      row.field_json = players
      row.field_fingerprint = fieldCheck.fingerprint
      row.field_source = fieldSource
      row.last_field_fetch = lastUpdated || new Date().toISOString()
      result.fieldsUpdated++
    } else if (players.length > 0) {
      result.fieldsRejected++
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
        delete row.field_fingerprint
        delete row.field_source
        delete row.last_field_fetch
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
      if (Array.isArray(row.field_json)) {
        await pruneOpenStandardPoolPicksForTournament(supabase, existing.id, row.field_json)
      }
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
      .or('game_format.eq.standard,and(game_format.neq.standard,groups_finalized_at.not.is.null)')
      .select('id')

    if (error) throw error
    result.poolsAutoLocked = lockedPools?.length || 0
  }

  const groupFinalization = await autoFinalizeGroupedPools(supabase)
  result.groupedPoolsAutoFinalized = groupFinalization.finalized

  return result
}
