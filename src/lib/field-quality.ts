import type { GolfPlayer } from './golf-api'

export type FieldSource = 'espn_scoreboard' | 'espn_event' | 'pga_tour' | 'stored' | 'unknown'

export type FieldMeta = {
  players: GolfPlayer[]
  fingerprint: string
  source: FieldSource
  lastUpdated?: string | null          // from PGA Tour (e.g. "2026-05-28T10:30:00.000Z")
  fetchedAt: string                   // ISO string when we got it
}

// In-memory failure tracker for upcoming tournaments with no field.
// Key = tournamentId, value = { count, lastAttempt, notified }
const fieldFailureTracker = new Map<
  string,
  { count: number; lastAttempt: number; notified: boolean }
>()

const FAILURE_ALERT_THRESHOLD = 3        // alert after 3 consecutive failures
const FAILURE_RESET_HOURS = 24           // reset counter if 24h pass with no attempts

export function recordFieldFetchAttempt(tournamentId: string, success: boolean) {
  const now = Date.now()
  const existing = fieldFailureTracker.get(tournamentId)
  if (!existing || now - existing.lastAttempt > FAILURE_RESET_HOURS * 3600_000) {
    // Reset stale tracker
    fieldFailureTracker.set(tournamentId, { count: success ? 0 : 1, lastAttempt: now, notified: false })
    return
  }
  if (success) {
    existing.count = 0
    existing.notified = false
  } else {
    existing.count += 1
  }
  existing.lastAttempt = now
}

export function shouldAlertOnFieldFailures(tournamentId: string): {
  shouldAlert: boolean
  failureCount: number
} {
  const entry = fieldFailureTracker.get(tournamentId)
  if (!entry || entry.count < FAILURE_ALERT_THRESHOLD) {
    return { shouldAlert: false, failureCount: entry?.count || 0 }
  }
  if (entry.notified) return { shouldAlert: false, failureCount: entry.count }
  entry.notified = true
  return { shouldAlert: true, failureCount: entry.count }
}

export function getFieldFailureSummary(): Array<{
  tournamentId: string
  count: number
  lastAttempt: number
  notified: boolean
}> {
  return Array.from(fieldFailureTracker.entries()).map(([id, v]) => ({
    tournamentId: id,
    count: v.count,
    lastAttempt: v.lastAttempt,
    notified: v.notified,
  }))
}

export function clearFieldFailureTracker() {
  fieldFailureTracker.clear()
}

export function fieldFingerprint(players: GolfPlayer[]): string {
  return players.map(p => p.name).sort().join('|')
}

export function looksLikePlaceholderField(players: GolfPlayer[], otherTournamentIds?: string[]): {
  isPlaceholder: boolean
  reason: string
} {
  if (!Array.isArray(players) || players.length === 0) {
    return { isPlaceholder: true, reason: 'empty' }
  }

  // 1. Too small for a real PGA Tour field (usually 140-156)
  if (players.length < 40) {
    return { isPlaceholder: true, reason: `too_small(${players.length})` }
  }

  // 2. Known stale ESPN placeholder head — Kisner/Blair/Bezuidenhout/Hardy cluster
  const topNames = players.slice(0, 8).map(p => p.name)
  const staleSignature = ['Kevin Kisner', 'Zac Blair', 'Christiaan Bezuidenhout', 'Nick Hardy']
  const hitCount = staleSignature.filter(n => topNames.includes(n)).length
  if (hitCount >= 3) {
    return { isPlaceholder: true, reason: 'known_stale_signature' }
  }

  // 3. Cross-hash collision: exact same player set already assigned to other tournaments
  if (otherTournamentIds && otherTournamentIds.length > 0) {
    return {
      isPlaceholder: true,
      reason: `collision(${otherTournamentIds.length})`,
    }
  }

  return { isPlaceholder: false, reason: 'ok' }
}

export function isFieldAcceptableForLock(
  players: GolfPlayer[],
  opts: {
    source?: FieldSource
    lastUpdated?: string | null
    storedLastUpdated?: string | null
    otherTournamentIds?: string[]
    tournamentName?: string | null
    force?: boolean
  } = {}
): { ok: boolean; reason: string } {
  if (opts.force) {
    return { ok: true, reason: 'forced' }
  }

  if (!Array.isArray(players) || players.length === 0) {
    return { ok: false, reason: 'empty' }
  }

  // Source confidence ladder
  if (opts.source === 'pga_tour') {
    // PGA Tour field must be reasonably sized
    if (players.length < 40) return { ok: false, reason: 'pga_tour_too_small' }
    return { ok: true, reason: 'pga_tour_fresh' }
  }

  const placeholder = looksLikePlaceholderField(players, opts.otherTournamentIds)
  if (placeholder.isPlaceholder) {
    return { ok: false, reason: placeholder.reason }
  }

  // Stored-field freshness gate: only accept if fetched within last 24h
  if (opts.source === 'stored') {
    const isHeroWorldChallenge = (opts.tournamentName || '').toLowerCase().includes('hero')
    const freshThreshold = isHeroWorldChallenge ? 48 : 24 // hours
    const thresholdMs = freshThreshold * 60 * 60 * 1000

    const lastFetch = opts.lastUpdated || opts.storedLastUpdated
    if (lastFetch) {
      const fetchMs = new Date(lastFetch).getTime()
      const nowMs = Date.now()
      if (Number.isFinite(fetchMs) && nowMs - fetchMs <= thresholdMs) {
        return { ok: true, reason: `stored_fresh(${freshThreshold}h)` }
      }
    }
    return { ok: false, reason: `stored_stale(${freshThreshold}h)` }
  }

  return { ok: true, reason: 'sanity_passed' }
}

