import { createClient } from '@supabase/supabase-js'
import { getLeaderboard, getSchedule, inferInactiveStatusesFromRounds, mapCompetitorToPlayer, enrichPlayersWithTeeTimes, enrichPlayersWithFirstRoundTeeTimes } from './golf-api'
import { autoFinalizeGroupedPools } from './grouped-pool-auto-lock'
import { finalizeCompletedPoolResults, type FinalizeResult } from './finalize-pool-results'
import { autoLockPools, firstTeeTimeFromField, tournamentIsInLiveActivationWindow } from './pool-auto-lock'
import { findPgaTourTournament, getPgaTourFieldWithMeta, getPgaTourSchedule } from './pga-tour-field'
import { fieldFingerprint, looksLikePlaceholderField, recordFieldFetchAttempt, shouldAlertOnFieldFailures } from './field-quality'
import { recordNotificationEvent, sendPushToUser } from './notifications/push'
import { hasPostCutRoundEvidence, hasWeekendCutStatusErrors, repairWeekendCutStatuses } from './leaderboard-sanity'
import { sendWdPickAlertsForTournament } from './wd-pick-alerts'

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
  emptyEntriesAutoRemoved: number
  groupedPoolsAutoFinalized: number
  finalResults?: FinalizeResult
  wdAlertsSent?: number
  wdAlertsNoEmail?: number
  skipped?: boolean
  reason?: string
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

  // Never mark a tournament completed from calendar time alone. Rain delays,
  // Monday finishes, playoffs, and stale API payloads make endDate unsafe.
  return 'upcoming'
}

function extractPlayers(event: any) {
  const competitors = event.competitions?.[0]?.competitors || []
  const round = event.status?.period || event.competitions?.[0]?.status?.period
  return repairWeekendCutStatuses(inferInactiveStatusesFromRounds(competitors.map(mapCompetitorToPlayer), round))
    .filter((player: any) => player.name && player.name !== 'Unknown')
}

export function finalRoundLooksComplete(players: any[], round?: number | null) {
  const reportedRound = Number(round || 0)
  if (reportedRound < 4) return false
  const activePlayers = players.filter(player => player?.status === 'active')
  if (activePlayers.length === 0) return false

  const activeRounds = activePlayers.flatMap(player =>
    (Array.isArray(player?.roundScores) ? player.roundScores : [])
      .map((score: any) => Number(score?.round))
      .filter(Number.isFinite)
  )
  const latestScorecardRound = Math.max(0, ...activeRounds)
  const scoringRound = activePlayers.some(player =>
    (Array.isArray(player?.roundScores) ? player.roundScores : []).some((score: any) => Number(score?.round) === reportedRound)
  )
    ? reportedRound
    : latestScorecardRound

  if (scoringRound < 4) return false

  return activePlayers.every(player => {
    if (String(player?.thru || '').toUpperCase() === 'F') return true
    const finalRound = Array.isArray(player?.roundScores)
      ? player.roundScores.find((score: any) => Number(score?.round) === scoringRound)
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
    if (oldStatus === 'cut' && newStatus === 'active' && hasPostCutRoundEvidence(player)) return player
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

async function clearCorruptStoredTournamentJsonIfNeeded(supabase: any, existing: any, row: Record<string, any>) {
  if (!existing?.id) return
  const willWriteLeaderboard = Array.isArray(row.leaderboard_json)
  const willWriteField = Array.isArray(row.field_json)
  if (!willWriteLeaderboard && !willWriteField) return
  const storedHasWeekendCutErrors = hasWeekendCutStatusErrors(existing.leaderboard_json)
    || hasWeekendCutStatusErrors(existing.field_json)
  if (!storedHasWeekendCutErrors) return

  // Production has a DB trigger that preserves enriched JSON fields across
  // tournament updates. If the stored board is already corrupt, a direct JSON
  // update can re-merge the old CUT status back into the fresh board. Null the
  // stored JSON first, then write the fresh repaired board in the caller.
  const { error } = await supabase
    .from('gpp_tournaments')
    .update({ leaderboard_json: null, field_json: null })
    .eq('id', existing.id)
  if (error) throw error
  existing.leaderboard_json = null
  existing.field_json = null
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

async function fieldUpdatePushAllowed() {
  return true
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
  if (!await fieldUpdatePushAllowed()) return
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

export async function refreshPgaTourFields(supabase: any, season: number): Promise<{ checked: number; refreshed: number; rejected: number; alertsSent: number; wdAlertsSent: number; wdAlertsNoEmail: number; failures: Array<{ tournamentId: string; name: string; count: number }> }> {
  const result = { checked: 0, refreshed: 0, rejected: 0, alertsSent: 0, wdAlertsSent: 0, wdAlertsNoEmail: 0, failures: [] as Array<{ tournamentId: string; name: string; count: number }> }
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
    const wdAlerts = await sendWdPickAlertsForTournament(supabase, t.id, fresh.players)
    result.wdAlertsSent += wdAlerts.sent
    result.wdAlertsNoEmail += wdAlerts.noEmail

    result.refreshed++
  }

  return result
}

type LiveSyncActivationTournament = {
  external_id?: string | null
  start_date?: string | null
  status?: string | null
  field_json?: Array<{ teeTime?: string | null }> | null
}

export function liveSyncActivationForTournament(tournament: LiveSyncActivationTournament, today: string, now: Date) {
  const status = String(tournament.status || '').toLowerCase()
  if (status === 'live') return { shouldActivate: true, dateFallback: false }
  if (status !== 'upcoming') return { shouldActivate: false, dateFallback: false }

  const firstTee = firstTeeTimeFromField(tournament.field_json)
  if (firstTee) {
    return { shouldActivate: tournamentIsInLiveActivationWindow({ id: 'live-sync', ...tournament }, now), dateFallback: false }
  }

  const dateFallback = Boolean(tournament.start_date && tournament.start_date <= today)
  return { shouldActivate: dateFallback, dateFallback }
}

export function resolveLiveSyncStatus(status: string, storedField: Array<{ teeTime?: string | null }> | null | undefined, now: Date, activatedByFirstTee: boolean) {
  const normalizedStatus = String(status || '').toLowerCase()
  const espnLiveBeforeFirstTee = (normalizedStatus === 'live' || normalizedStatus === 'completed')
    && firstTeeTimeFromField(storedField)
    && !tournamentIsInLiveActivationWindow({ id: 'live-sync', status: 'upcoming', field_json: storedField }, now)

  if (espnLiveBeforeFirstTee) return 'upcoming'
  if (normalizedStatus === 'upcoming' && activatedByFirstTee) return 'live'
  return normalizedStatus || 'upcoming'
}

async function liveSyncActivationState(supabase: any, now: Date) {
  const { data: tournaments, error } = await supabase
    .from('gpp_tournaments')
    .select('id, external_id, start_date, status, field_json')
    .in('status', ['upcoming', 'live'])

  if (error) throw error

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const activatedExternalIds = new Set<string>()
  let hasLiveTournament = false
  let hasDateFallbackDue = false
  for (const tournament of tournaments || []) {
    const activation = liveSyncActivationForTournament(tournament, today, now)
    if (!activation.shouldActivate) continue
    if (activation.dateFallback) hasDateFallbackDue = true
    const status = String(tournament.status || '').toLowerCase()
    if (status === 'live') hasLiveTournament = true
    if (tournament.external_id) activatedExternalIds.add(String(tournament.external_id))
  }

  return {
    shouldSync: hasLiveTournament || hasDateFallbackDue || activatedExternalIds.size > 0,
    activatedExternalIds,
  }
}

async function syncLiveFromScoreboard(supabase: any, season: number): Promise<TournamentSyncResult> {
  const now = new Date()
  const activation = await liveSyncActivationState(supabase, now)
  const result: TournamentSyncResult = {
    season,
    fetched: 0,
    inserted: 0,
    updated: 0,
    fieldsUpdated: 0,
    fieldsRejected: 0,
    leaderboardsUpdated: 0,
    poolsAutoLocked: 0,
    emptyEntriesAutoRemoved: 0,
    groupedPoolsAutoFinalized: 0,
    wdAlertsSent: 0,
    wdAlertsNoEmail: 0,
  }

  if (!activation.shouldSync) {
    return { ...result, skipped: true, reason: 'no-live-or-first-tee-window' }
  }

  const poolLock = await autoLockPools(supabase, { now })
  result.poolsAutoLocked = poolLock.locked
  result.emptyEntriesAutoRemoved = poolLock.emptyEntriesAutoRemoved

  const scoreboardEvents = await fetchScoreboardEvents()
  result.fetched = scoreboardEvents.length

  const liveTournamentIds: string[] = []
  const fingerprintMap = await loadExistingFingerprints(supabase)
  let pgaTourSchedule: any[] | null = null

  for (const event of scoreboardEvents) {
    const normalized = rowFromEvent(event, season)
    if (!normalized) continue

    const { row, players } = normalized
    let { status } = normalized

    const { data: existing, error: existingError } = await supabase
      .from('gpp_tournaments')
      .select('id, status, leaderboard_json, field_json, field_fingerprint, field_source, last_field_fetch')
      .eq('external_id', row.external_id)
      .maybeSingle()

    if (existingError) throw existingError

    status = resolveLiveSyncStatus(
      status,
      existing?.field_json,
      now,
      activation.activatedExternalIds.has(row.external_id),
    )
    row.status = status

    const liveLeaderboard = (status === 'live' || status === 'completed') ? await getLeaderboard(row.external_id).catch(() => null) : null
    let playersForStorage = repairWeekendCutStatuses(liveLeaderboard?.leaderboard?.length ? liveLeaderboard.leaderboard : players)

    // ESPN general scoreboard often returns zero competitors for pre events.
    // Try the event-specific endpoint before falling back to PGA Tour.
    if (playersForStorage.length === 0 && status === 'upcoming') {
      const eventSpecificPlayers = await fetchEventSpecificField(row.external_id)
      if (eventSpecificPlayers.length > 0) {
        playersForStorage = eventSpecificPlayers
      }
    }

    let fieldSource: 'espn_scoreboard' | 'espn_event' | 'pga_tour' = playersForStorage.length > 0 && playersForStorage === players
      ? 'espn_scoreboard'
      : 'espn_event'
    let fieldLastUpdated: string | null = null
    let pgaMatchedWithoutField = false

    // The minute sync can run before first tee and must obey the same upcoming-field
    // source rule as refresh-fields: PGA Tour is canonical when it matches.
    if (status === 'upcoming') {
      if (!pgaTourSchedule) pgaTourSchedule = await getPgaTourSchedule(season).catch(() => [])
      const pgaTourTournament = findPgaTourTournament({
        pgaSchedule: pgaTourSchedule,
        eventName: row.name,
        startDate: row.start_date,
      })
      if (pgaTourTournament?.tournamentId) {
        const pgaMeta = await getPgaTourFieldWithMeta(pgaTourTournament.tournamentId).catch(() => ({ players: [], lastUpdated: null }))
        if (pgaMeta.players.length > 0) {
          playersForStorage = pgaMeta.players
          fieldSource = 'pga_tour'
          fieldLastUpdated = pgaMeta.lastUpdated
        } else {
          pgaMatchedWithoutField = true
        }
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

    if (pgaMatchedWithoutField && fieldSource !== 'pga_tour') {
      result.fieldsRejected++
    } else {
      const fieldCheck = shouldAcceptField(
        playersForStorage,
        fieldSource,
        existing?.field_fingerprint,
        fingerprintMap,
        existing?.id || row.external_id,
      )

      const wouldDowngradeOfficialField = existing?.field_source === 'pga_tour'
        && fieldSource !== 'pga_tour'
        && status === 'upcoming'

      if (fieldCheck.ok && !wouldDowngradeOfficialField) {
        row.field_json = playersForStorage
        row.field_fingerprint = fieldCheck.fingerprint
        row.field_source = fieldSource
        row.last_field_fetch = fieldLastUpdated || new Date().toISOString()
        result.fieldsUpdated++
      } else if (playersForStorage.length > 0) {
        if (wouldDowngradeOfficialField) {
          console.warn(`[sync] Preserved PGA Tour field for ${existing?.id || row.external_id}; rejected ${fieldSource} downgrade`)
        }
        result.fieldsRejected++
      }
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
        && !hasWeekendCutStatusErrors(existing.leaderboard_json)

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
      await clearCorruptStoredTournamentJsonIfNeeded(supabase, existing, row)
      const { error } = await supabase.from('gpp_tournaments').update(row).eq('id', existing.id)
      if (error) throw error
      if (Array.isArray(row.field_json)) {
        await pruneOpenStandardPoolPicksForTournament(supabase, existing.id, row.field_json)
        const wdAlerts = await sendWdPickAlertsForTournament(supabase, existing.id, row.field_json)
        result.wdAlertsSent = (result.wdAlertsSent || 0) + wdAlerts.sent
        result.wdAlertsNoEmail = (result.wdAlertsNoEmail || 0) + wdAlerts.noEmail
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
    const postSyncPoolLock = await autoLockPools(supabase, { now })
    result.poolsAutoLocked += postSyncPoolLock.locked
    result.emptyEntriesAutoRemoved += postSyncPoolLock.emptyEntriesAutoRemoved
  }

  const groupFinalization = await autoFinalizeGroupedPools(supabase)
  result.groupedPoolsAutoFinalized = groupFinalization.finalized

  result.finalResults = await finalizeCompletedPoolResults(supabase)

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
    emptyEntriesAutoRemoved: 0,
    groupedPoolsAutoFinalized: 0,
    wdAlertsSent: 0,
    wdAlertsNoEmail: 0,
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
    const espnPlayers = extractPlayers(bestEvent)
    let players = status === 'upcoming' ? [] : espnPlayers
    let pgaMeta: { players: any[]; lastUpdated: string | null } = { players: [], lastUpdated: null }
    let hasPgaTourMatch = false

    // For upcoming tournaments, PGA Tour is the canonical field source. ESPN
    // frequently returns future-event placeholders; if a PGA Tour match exists
    // but the fetch is empty/transiently unavailable, preserve the stored field
    // instead of falling back to ESPN and poisoning Supabase.
    if (status === 'upcoming') {
      const pgaTourTournament = findPgaTourTournament({
        pgaSchedule: pgaTourSchedule,
        eventName: bestEvent.name || event.name,
        startDate,
      })
      hasPgaTourMatch = Boolean(pgaTourTournament?.tournamentId)
      if (pgaTourTournament?.tournamentId) {
        pgaMeta = await getPgaTourFieldWithMeta(pgaTourTournament.tournamentId).catch(() => ({ players: [], lastUpdated: null }))
        if (pgaMeta.players.length > 0) players = pgaMeta.players
      }
    }

    // Only use ESPN as an upcoming-field fallback when PGA Tour cannot match
    // the event at all. A matched-but-empty PGA Tour fetch is a failure to
    // alert/preserve through, not permission to use ESPN placeholders.
    if (players.length === 0 && status === 'upcoming' && !hasPgaTourMatch) {
      const eventSpecificPlayers = await fetchEventSpecificField(externalId)
      players = eventSpecificPlayers.length > 0 ? eventSpecificPlayers : espnPlayers
    }

    if (!startDate || !endDate) continue

    const { data: existing, error: existingError } = await supabase
      .from('gpp_tournaments')
      .select('id, status, leaderboard_json, field_json, field_fingerprint, field_source, last_field_fetch')
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

    const wouldDowngradeOfficialField = existing?.field_source === 'pga_tour'
      && fieldSource !== 'pga_tour'
      && status === 'upcoming'

    if (fieldCheck.ok && !wouldDowngradeOfficialField) {
      row.field_json = players
      row.field_fingerprint = fieldCheck.fingerprint
      row.field_source = fieldSource
      row.last_field_fetch = lastUpdated || new Date().toISOString()
      result.fieldsUpdated++
    } else if (players.length > 0) {
      if (wouldDowngradeOfficialField) {
        console.warn(`[sync] Preserved PGA Tour field for ${existing?.id || row.external_id}; rejected ${fieldSource} downgrade`)
      }
      result.fieldsRejected++
    }

    let leaderboardPlayers: any[] | null = null
    let leaderboardRound: number | null = null
    if ((doLive && (status === 'live' || status === 'completed')) || (status === 'completed' && hasWeekendCutStatusErrors(existing?.leaderboard_json))) {
      const leaderboard = await getLeaderboard(externalId).catch(() => null)
      if (leaderboard?.leaderboard?.length) {
        leaderboardPlayers = repairWeekendCutStatuses(leaderboard.leaderboard)
        leaderboardRound = leaderboard.round
        row.leaderboard_json = leaderboardPlayers
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
        && !hasWeekendCutStatusErrors(existing.leaderboard_json)

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
      await clearCorruptStoredTournamentJsonIfNeeded(supabase, existing, row)
      const { error } = await supabase.from('gpp_tournaments').update(row).eq('id', existing.id)
      if (error) throw error
      if (Array.isArray(row.field_json)) {
        await pruneOpenStandardPoolPicksForTournament(supabase, existing.id, row.field_json)
        const wdAlerts = await sendWdPickAlertsForTournament(supabase, existing.id, row.field_json)
        result.wdAlertsSent = (result.wdAlertsSent || 0) + wdAlerts.sent
        result.wdAlertsNoEmail = (result.wdAlertsNoEmail || 0) + wdAlerts.noEmail
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
    const poolLock = await autoLockPools(supabase)
    result.poolsAutoLocked += poolLock.locked
    result.emptyEntriesAutoRemoved += poolLock.emptyEntriesAutoRemoved
  }

  const groupFinalization = await autoFinalizeGroupedPools(supabase)
  result.groupedPoolsAutoFinalized = groupFinalization.finalized

  result.finalResults = await finalizeCompletedPoolResults(supabase)

  return result
}
