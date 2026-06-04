export type PoolPickCountConfig = {
  game_format?: string | null
  pick_count?: number | null
  count_scores?: number | null
  group_count?: number | null
  picks_per_group?: number | null
  pick_groups_json?: unknown | null
}

function numericOr(value: number | null | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

function groupedSnapshotPickTotal(pickGroupsJson: unknown) {
  const groups = Array.isArray(pickGroupsJson)
    ? pickGroupsJson
    : pickGroupsJson && typeof pickGroupsJson === 'object'
      ? (pickGroupsJson as Record<string, unknown>).groups
      : null

  if (!Array.isArray(groups) || groups.length === 0) return null

  return groups.reduce((sum, group) => {
    if (!group || typeof group !== 'object') return sum + 1
    return sum + numericOr((group as Record<string, unknown>).picks_per_group as number | null | undefined, 1)
  }, 0)
}

export function isGroupedPoolFormat(format?: string | null) {
  return format === 'ranked_groups' || format === 'random_groups' || format === 'grouped'
}

export function totalPicksRequired(pool: PoolPickCountConfig) {
  if (isGroupedPoolFormat(pool.game_format)) {
    const explicitPickCount = typeof pool.pick_count === 'number' && Number.isFinite(pool.pick_count) && pool.pick_count > 0
      ? pool.pick_count
      : null
    if (explicitPickCount !== null) return explicitPickCount

    const snapshotTotal = groupedSnapshotPickTotal(pool.pick_groups_json)
    if (snapshotTotal !== null) return snapshotTotal
    return numericOr(pool.picks_per_group, 2) * numericOr(pool.group_count, 6)
  }

  return numericOr(pool.pick_count, 12)
}
