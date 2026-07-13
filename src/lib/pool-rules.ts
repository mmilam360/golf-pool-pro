export const MAX_POOL_PICKS = 12
export const MAX_GROUP_COUNT = 12
export const MAX_PICKS_PER_GROUP = 6
export const DEFAULT_STANDARD_PICK_COUNT = 12
export const DEFAULT_COUNT_SCORES = 8
export const DEFAULT_GROUP_COUNT = 6
export const DEFAULT_PICKS_PER_GROUP = 2

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function safePositiveInt(value: unknown, fallback: number) {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback
}

export function maxPicksPerGroupForGroupCount(groupCount: number) {
  const safeGroupCount = clampNumber(safePositiveInt(groupCount, DEFAULT_GROUP_COUNT), 1, MAX_GROUP_COUNT)
  return clampNumber(Math.floor(MAX_POOL_PICKS / safeGroupCount), 1, MAX_PICKS_PER_GROUP)
}

export function normalizeStandardPoolSettings({
  pickCount,
  countScores,
}: {
  pickCount: unknown
  countScores: unknown
}) {
  const normalizedPickCount = clampNumber(safePositiveInt(pickCount, DEFAULT_STANDARD_PICK_COUNT), 1, MAX_POOL_PICKS)
  const normalizedCountScores = clampNumber(safePositiveInt(countScores, DEFAULT_COUNT_SCORES), 1, normalizedPickCount)
  return {
    pickCount: normalizedPickCount,
    countScores: normalizedCountScores,
  }
}

export function normalizeGroupedPoolSettings({
  groupCount,
  picksPerGroup,
  countScores,
}: {
  groupCount: unknown
  picksPerGroup: unknown
  countScores: unknown
}) {
  const normalizedGroupCount = clampNumber(safePositiveInt(groupCount, DEFAULT_GROUP_COUNT), 2, MAX_GROUP_COUNT)
  const maxPicksPerGroup = maxPicksPerGroupForGroupCount(normalizedGroupCount)
  const normalizedPicksPerGroup = clampNumber(safePositiveInt(picksPerGroup, DEFAULT_PICKS_PER_GROUP), 1, maxPicksPerGroup)
  const pickCount = normalizedGroupCount * normalizedPicksPerGroup
  const normalizedCountScores = clampNumber(safePositiveInt(countScores, Math.min(DEFAULT_COUNT_SCORES, pickCount)), 1, pickCount)
  return {
    groupCount: normalizedGroupCount,
    picksPerGroup: normalizedPicksPerGroup,
    pickCount,
    countScores: normalizedCountScores,
    maxPicksPerGroup,
  }
}
