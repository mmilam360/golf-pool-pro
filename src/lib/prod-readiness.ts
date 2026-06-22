import { activeEntries, daysFromToday, derivePaymentState, entriesMissingFrozenResults, entryHasSubmittedPicks, FIELD_STALE_DAYS, fieldAgeDays, finalPool, groupedPoolNeedsGroups, hasStoredLeaderboard, jsonRows, LIVE_SCORE_STALE_MINUTES, liveScoresAreStale, lockedOrScoring, minutesAgo, normalizeTournamentStatus, tournamentDateWindowIncludes, tournamentIsLive, upcomingFieldReadinessWindow, type EntryStateInput, type PoolStateInput, type TournamentStateInput } from './pool-state'

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3, info: 4 } as const

export type ProdReadinessSeverity = keyof typeof SEVERITY_RANK

export type ProdReadinessIssue = {
  severity: ProdReadinessSeverity
  code: string
  message: string
  details: Record<string, unknown>
}

export type ProdReadinessResult = {
  ok: boolean
  checkedAt: string
  usingServiceRole: boolean
  poolLimit: number
  poolCount: number
  skippedTestPools: number
  entryCount: number
  cronRunCount: number
  counts: Record<ProdReadinessSeverity, number>
  issues: ProdReadinessIssue[]
}

type PoolWithTournament = PoolStateInput & {
  gpp_tournaments?: TournamentStateInput | TournamentStateInput[] | null
}

type ReadinessEntry = EntryStateInput & {
  pool_id?: string | null
}

function normalizeTournament(pool: PoolWithTournament) {
  const value = pool?.gpp_tournaments
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function activeEntriesForPool(entriesByPool: Map<string, ReadinessEntry[]>, poolId?: string | null) {
  return poolId ? activeEntries(entriesByPool.get(poolId) || []) : []
}

export function isOperationalTestPool(pool: PoolWithTournament, tournament?: TournamentStateInput | null) {
  const label = `${pool.name || ''} ${tournament?.name || ''}`.toLowerCase()
  return /(^|\s)(qa|test|hermes)(\s|$)/.test(label)
    || label.includes('dashboard tee times')
    || label.includes('browser guest')
    || label.includes('final trigger')
}

function issue(issues: ProdReadinessIssue[], severity: ProdReadinessSeverity, code: string, message: string, details: Record<string, unknown> = {}) {
  issues.push({ severity, code, message, details })
}

export function summarizeProdReadinessIssues(issues: ProdReadinessIssue[]) {
  const counts: Record<ProdReadinessSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  for (const item of issues) counts[item.severity] = (counts[item.severity] || 0) + 1
  return counts
}

export function sortProdReadinessIssues(issues: ProdReadinessIssue[]) {
  return [...issues].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.code.localeCompare(b.code))
}

export function formatProdReadinessIssue(item: ProdReadinessIssue) {
  const details = Object.entries(item.details || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(' ')
  return `- [${item.severity.toUpperCase()}] ${item.code}: ${item.message}${details ? ` (${details})` : ''}`
}

export function auditProdReadiness(input: {
  pools: PoolWithTournament[]
  entries: ReadinessEntry[]
  cronRuns?: unknown[] | null
  checkedAt?: Date
  usingServiceRole?: boolean
  poolLimit?: number
  fieldWindowDays?: number
  includeTestPools?: boolean
}) {
  const now = input.checkedAt || new Date()
  const fieldWindowDays = input.fieldWindowDays ?? 14
  let skippedTestPools = 0
  const issues: ProdReadinessIssue[] = []
  const entriesByPool = new Map<string, ReadinessEntry[]>()

  if (!input.usingServiceRole) {
    issue(issues, 'medium', 'AUDIT_USING_ANON_KEY', 'Audit is using anon key; RLS may hide production rows. Prefer SUPABASE_SERVICE_ROLE_KEY for read-only ops audit.')
  }

  for (const entry of input.entries || []) {
    if (!entry.pool_id) continue
    const list = entriesByPool.get(entry.pool_id) || []
    list.push(entry)
    entriesByPool.set(entry.pool_id, list)
  }

  for (const pool of input.pools || []) {
    const tournament = normalizeTournament(pool)
    if (!input.includeTestPools && isOperationalTestPool(pool, tournament)) {
      skippedTestPools += 1
      continue
    }
    const currentEntries = activeEntriesForPool(entriesByPool, pool.id)
    const entryCount = currentEntries.length
    const payment = derivePaymentState({
      storedStatus: pool.payment_status,
      activeEntryCount: entryCount,
      amountPaidCents: pool.amount_paid_cents,
    })
    const isFinal = finalPool(pool, tournament)
    const poolLabel = `${pool.name || 'Unnamed pool'} (${pool.id})`
    const startDays = daysFromToday(tournament?.start_date, now)
    const endDays = daysFromToday(tournament?.end_date, now)

    if (isFinal && pool.payment_status === 'archived_unpaid') {
      issue(issues, 'critical', 'FINAL_POOL_ARCHIVED_UNPAID', 'Final/completed pool has archived_unpaid payment status; final boards should not be billing-blocked.', {
        pool: poolLabel,
        tournament: tournament?.name,
      })
    }

    if (lockedOrScoring(pool, tournament) && payment.amountDueCents > 0 && pool.payment_status === 'active') {
      issue(issues, 'high', 'ACTIVE_STATUS_WITH_BALANCE_DUE', 'Pool is stored active even though active entry count implies a balance due.', {
        pool: poolLabel,
        entryCount,
        amountPaidCents: payment.amountPaidCents,
        expectedFeeCents: payment.expectedFeeCents,
        dueCents: payment.amountDueCents,
      })
    }

    if (isFinal) {
      const submittedEntries = currentEntries.filter(entryHasSubmittedPicks)
      const missingFrozen = entriesMissingFrozenResults(currentEntries)
      if (submittedEntries.length > 0 && missingFrozen.length > 0) {
        issue(issues, 'critical', 'FINAL_POOL_MISSING_FROZEN_RESULTS', 'Final/completed pool has submitted entries without frozen final rank/score/counting_scores.', {
          pool: poolLabel,
          missingEntries: missingFrozen.length,
          submittedEntries: submittedEntries.length,
          activeEntries: currentEntries.length,
        })
      }
    }

    if (tournamentIsLive(tournament)) {
      const rows = jsonRows(tournament?.leaderboard_json).length
      const staleMinutes = minutesAgo(tournament?.last_scores_fetch, now)
      if (rows === 0) {
        issue(issues, 'critical', 'LIVE_TOURNAMENT_EMPTY_LEADERBOARD', 'Live tournament has no stored leaderboard rows.', {
          pool: poolLabel,
          tournament: tournament?.name,
        })
      }
      if (liveScoresAreStale(tournament, LIVE_SCORE_STALE_MINUTES, now)) {
        issue(issues, 'high', 'LIVE_SCORE_STALE', 'Live tournament scores are stale or missing last_scores_fetch.', {
          pool: poolLabel,
          tournament: tournament?.name,
          lastScoresFetch: tournament?.last_scores_fetch,
          staleMinutes,
        })
      }
    }

    if (!isFinal && normalizeTournamentStatus(tournament?.status) === 'upcoming' && tournamentDateWindowIncludes(tournament, now) && hasStoredLeaderboard(tournament)) {
      issue(issues, 'high', 'TOURNAMENT_STATUS_STALE_WITH_LEADERBOARD', 'Tournament is inside its date window with stored leaderboard rows but status is still upcoming.', {
        pool: poolLabel,
        tournament: tournament?.name,
        startDate: tournament?.start_date,
        endDate: tournament?.end_date,
        leaderboardRows: jsonRows(tournament?.leaderboard_json).length,
      })
    }

    if (!isFinal && upcomingFieldReadinessWindow(tournament, fieldWindowDays, now)) {
      const rows = jsonRows(tournament?.field_json)
      const staleFieldDays = fieldAgeDays(tournament, now)
      if (rows.length < 40) {
        issue(issues, 'high', 'UPCOMING_POOL_FIELD_NOT_READY', 'Upcoming pool is inside field-readiness window but stored field has fewer than 40 golfers.', {
          pool: poolLabel,
          tournament: tournament?.name,
          startDate: tournament?.start_date,
          startDays,
          fieldCount: rows.length,
          fieldSource: (tournament as any)?.field_source,
        })
      }
      if (staleFieldDays == null || staleFieldDays > FIELD_STALE_DAYS) {
        issue(issues, 'medium', 'UPCOMING_POOL_FIELD_STALE', 'Upcoming pool field is missing or stale inside readiness window.', {
          pool: poolLabel,
          tournament: tournament?.name,
          startDate: tournament?.start_date,
          lastFieldFetch: tournament?.last_field_fetch,
          staleFieldDays,
        })
      }
      if (groupedPoolNeedsGroups(pool) && startDays != null && startDays <= 2) {
        issue(issues, 'high', 'GROUPED_POOL_DUE_WITHOUT_GROUPS', 'Grouped pool is near start date but groups are not finalized.', {
          pool: poolLabel,
          tournament: tournament?.name,
          startDate: tournament?.start_date,
          startDays,
        })
      }
    }

    if (!isFinal && endDays != null && endDays < 0 && !pool.results_finalized_at) {
      issue(issues, 'high', 'PAST_POOL_NOT_FINALIZED', 'Tournament end date is past but pool has no results_finalized_at.', {
        pool: poolLabel,
        tournament: tournament?.name,
        endDate: tournament?.end_date,
      })
    }
  }

  if (input.cronRuns && input.cronRuns.length === 0) {
    issue(issues, 'medium', 'NO_CRON_RUN_HISTORY', 'gpp_cron_runs returned no rows; cron health cannot be verified from DB history.')
  }

  const sortedIssues = sortProdReadinessIssues(issues)
  const counts = summarizeProdReadinessIssues(sortedIssues)
  return {
    ok: counts.critical === 0 && counts.high === 0,
    checkedAt: now.toISOString(),
    usingServiceRole: Boolean(input.usingServiceRole),
    poolLimit: input.poolLimit || input.pools.length,
    poolCount: input.pools.length,
    skippedTestPools,
    entryCount: input.entries.length,
    cronRunCount: input.cronRuns?.length || 0,
    counts,
    issues: sortedIssues,
  } satisfies ProdReadinessResult
}
