import { normalizeGroupedPoolSettings, normalizeStandardPoolSettings } from './pool-rules'

export type PoolCloneSettings = {
  id?: string | null
  name?: string | null
  pick_count?: number | null
  count_scores?: number | null
  game_format?: string | null
  group_count?: number | null
  picks_per_group?: number | null
  ob_rule_enabled?: boolean | null
  ob_penalty_strokes?: number | null
}

export type PoolCloneDefaults = {
  sourceId: string
  sourceName: string
  poolName: string
  pickCount: number
  countScores: number
  gameFormat: 'standard' | 'ranked_groups' | 'random_groups'
  groupCount: number
  picksPerGroup: number
  obEnabled: boolean
  obPenalty: number
}

export type RunItBackTournament = {
  id?: string | null
  name?: string | null
  start_date?: string | null
  status?: string | null
}

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})/

function safeNumber(value: number | null | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function getDateOnly(value?: string | null) {
  return value?.match(DATE_ONLY_RE)?.[0] || null
}

function dateOnlyToUtcMs(value?: string | null) {
  const dateOnly = getDateOnly(value)
  if (!dateOnly) return null
  const [year, month, day] = dateOnly.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

function todayEasternDateOnly(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/New_York',
  }).formatToParts(now)
  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value
  const day = parts.find(part => part.type === 'day')?.value
  return year && month && day ? `${year}-${month}-${day}` : now.toISOString().slice(0, 10)
}

export function buildRunItBackDefaults(sourcePool: PoolCloneSettings): PoolCloneDefaults | null {
  if (!sourcePool.id) return null
  const poolName = sourcePool.name?.trim() || 'Golf Pool'
  const gameFormat = sourcePool.game_format === 'ranked_groups' || sourcePool.game_format === 'random_groups' ? sourcePool.game_format : 'standard'
  const standardSettings = normalizeStandardPoolSettings({
    pickCount: sourcePool.pick_count,
    countScores: sourcePool.count_scores,
  })
  const groupedSettings = normalizeGroupedPoolSettings({
    groupCount: sourcePool.group_count,
    picksPerGroup: sourcePool.picks_per_group,
    countScores: sourcePool.count_scores,
  })
  return {
    sourceId: sourcePool.id,
    sourceName: poolName,
    poolName,
    pickCount: gameFormat === 'standard' ? standardSettings.pickCount : groupedSettings.pickCount,
    countScores: gameFormat === 'standard' ? standardSettings.countScores : groupedSettings.countScores,
    gameFormat,
    groupCount: gameFormat === 'standard' ? 6 : groupedSettings.groupCount,
    picksPerGroup: gameFormat === 'standard' ? 2 : groupedSettings.picksPerGroup,
    obEnabled: Boolean(sourcePool.ob_rule_enabled),
    obPenalty: safeNumber(sourcePool.ob_penalty_strokes, 2),
  }
}

export function selectNextRunItBackTournament(
  tournaments: RunItBackTournament[],
  now = new Date(),
  maxDaysAway = 14
): RunItBackTournament | null {
  const today = todayEasternDateOnly(now)
  const todayMs = dateOnlyToUtcMs(today)
  if (todayMs === null) return null
  const latestAllowedMs = todayMs + maxDaysAway * 24 * 60 * 60 * 1000

  return tournaments
    .filter(tournament => tournament.id && tournament.status === 'upcoming')
    .filter(tournament => {
      const startDate = getDateOnly(tournament.start_date)
      return Boolean(startDate && startDate > today)
    })
    .filter(tournament => {
      const startMs = dateOnlyToUtcMs(tournament.start_date)
      return Boolean(startMs !== null && startMs <= latestAllowedMs)
    })
    .sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')))[0] ?? null
}
