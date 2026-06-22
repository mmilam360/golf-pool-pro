import { getDateOnly } from './date-utils'
import { jsonRows, tournamentDateWindowIncludes, tournamentHasOnCourseScores } from './pool-state'

type HealthTournament = {
  id: string
  external_id?: string | null
  name: string
  status?: string | null
  start_date?: string | null
  end_date?: string | null
  last_scores_fetch?: string | null
  leaderboard_json?: unknown
}

type HealthPool = {
  id: string
  tournament_id: string
  is_locked?: boolean | null
  is_completed?: boolean | null
}

type HealthCronRun = {
  route?: string | null
  status?: string | null
  started_at?: string | null
  finished_at?: string | null
  duration_ms?: number | null
  error?: string | null
}

type HealthIssue = {
  code: string
  severity: 'warning' | 'critical'
  tournamentId?: string
  tournamentName?: string
  message: string
}

function minutesSince(value: string | null | undefined, now: Date) {
  if (!value) return null
  const ms = now.getTime() - new Date(value).getTime()
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 60000)) : null
}

function leaderboardRows(tournament: HealthTournament) {
  return jsonRows(tournament.leaderboard_json).length
}

function latestCronRun(runs: HealthCronRun[], status: string) {
  return runs.find(run => run.status === status) || null
}

export function summarizeLiveScoringHealth(params: {
  tournaments: HealthTournament[]
  pools: HealthPool[]
  cronRuns: HealthCronRun[]
  staleAfterMinutes: number
  now?: Date
}) {
  const now = params.now || new Date()
  const poolsByTournament = new Map<string, HealthPool[]>()
  for (const pool of params.pools) {
    const current = poolsByTournament.get(pool.tournament_id) || []
    current.push(pool)
    poolsByTournament.set(pool.tournament_id, current)
  }

  const latestLiveSyncSuccess = latestCronRun(params.cronRuns, 'success')
  const latestLiveSyncFailure = latestCronRun(params.cronRuns, 'failure')
  const latestSuccessAgeMinutes = minutesSince(latestLiveSyncSuccess?.finished_at || latestLiveSyncSuccess?.started_at, now)
  const issues: HealthIssue[] = []

  const tournaments = params.tournaments.map(tournament => {
    const status = String(tournament.status || 'upcoming').toLowerCase()
    const rows = leaderboardRows(tournament)
    const scoreAgeMinutes = minutesSince(tournament.last_scores_fetch, now)
    const inDateWindow = tournamentDateWindowIncludes(tournament, now)
    const livePools = (poolsByTournament.get(tournament.id) || []).filter(pool => !pool.is_completed).length
    const hasOnCourse = tournamentHasOnCourseScores(tournament)

    if (inDateWindow && status === 'upcoming' && rows > 0) {
      issues.push({
        code: 'stale_tournament_status',
        severity: 'critical',
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        message: `${tournament.name} is inside its date window with ${rows} leaderboard rows but status is upcoming.`,
      })
    }

    if (inDateWindow && status === 'live' && rows === 0) {
      issues.push({
        code: 'live_without_leaderboard',
        severity: 'critical',
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        message: `${tournament.name} is live but has no stored leaderboard rows.`,
      })
    }

    if (inDateWindow && status === 'live' && livePools > 0 && rows > 0 && scoreAgeMinutes !== null && scoreAgeMinutes > params.staleAfterMinutes) {
      issues.push({
        code: 'stale_live_scores',
        severity: hasOnCourse ? 'critical' : 'warning',
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        message: `${tournament.name} scores were last fetched ${scoreAgeMinutes} minutes ago.`,
      })
    }

    if (inDateWindow && status === 'live' && livePools > 0 && rows > 0 && scoreAgeMinutes === null) {
      issues.push({
        code: 'missing_last_scores_fetch',
        severity: 'warning',
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        message: `${tournament.name} is live with leaderboard rows but no last_scores_fetch timestamp.`,
      })
    }

    return {
      id: tournament.id,
      externalId: tournament.external_id || null,
      name: tournament.name,
      status,
      startDate: getDateOnly(tournament.start_date),
      endDate: getDateOnly(tournament.end_date),
      inDateWindow,
      leaderboardRows: rows,
      hasOnCourseScores: hasOnCourse,
      lastScoresFetch: tournament.last_scores_fetch || null,
      scoreAgeMinutes,
      livePools,
    }
  })

  const hasLivePoolInWindow = tournaments.some(tournament => tournament.inDateWindow && tournament.livePools > 0)
  if (hasLivePoolInWindow && (latestSuccessAgeMinutes === null || latestSuccessAgeMinutes > params.staleAfterMinutes)) {
    issues.push({
      code: 'live_sync_run_stale',
      severity: 'critical',
      message: latestSuccessAgeMinutes === null
        ? 'No successful live sync cron run is recorded.'
        : `Latest successful live sync cron run is ${latestSuccessAgeMinutes} minutes old.`,
    })
  }

  return {
    ok: !issues.some(issue => issue.severity === 'critical'),
    checkedAt: now.toISOString(),
    staleAfterMinutes: params.staleAfterMinutes,
    tournaments,
    issues,
    latestLiveSyncSuccess,
    latestLiveSyncFailure,
  }
}
