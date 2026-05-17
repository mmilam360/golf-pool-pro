export type PoolCloneSettings = {
  id?: string | null
  name?: string | null
  pick_count?: number | null
  count_scores?: number | null
  ob_rule_enabled?: boolean | null
  ob_penalty_strokes?: number | null
}

export type PoolCloneDefaults = {
  sourceId: string
  sourceName: string
  poolName: string
  pickCount: number
  countScores: number
  obEnabled: boolean
  obPenalty: number
}

function safeNumber(value: number | null | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function buildRunItBackDefaults(sourcePool: PoolCloneSettings): PoolCloneDefaults | null {
  if (!sourcePool.id) return null
  const poolName = sourcePool.name?.trim() || 'Golf Pool'
  const pickCount = safeNumber(sourcePool.pick_count, 12)
  const countScores = Math.min(safeNumber(sourcePool.count_scores, 8), pickCount)
  return {
    sourceId: sourcePool.id,
    sourceName: poolName,
    poolName,
    pickCount,
    countScores,
    obEnabled: Boolean(sourcePool.ob_rule_enabled),
    obPenalty: safeNumber(sourcePool.ob_penalty_strokes, 2),
  }
}
