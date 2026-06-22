export type EntryPickFields = {
  id?: string
  golfer_picks?: unknown
  submitted_pick_count?: number | null
}

export function submittedPickCount(entry: Pick<EntryPickFields, 'golfer_picks' | 'submitted_pick_count'> | null | undefined) {
  const picks = Array.isArray(entry?.golfer_picks) ? entry.golfer_picks : []
  if (entry?.submitted_pick_count != null) {
    const storedCount = Number(entry.submitted_pick_count)
    if (Number.isFinite(storedCount)) return storedCount
  }
  return picks.length
}

export function entryNeedsPicks(entry: Pick<EntryPickFields, 'golfer_picks' | 'submitted_pick_count'>, requiredPickCount: number) {
  const pickCount = submittedPickCount(entry)
  if (requiredPickCount <= 0) return pickCount <= 0
  return pickCount < requiredPickCount
}

export function entryHasSubmittedPicks(entry: Pick<EntryPickFields, 'golfer_picks'>) {
  if (!Array.isArray(entry.golfer_picks)) return false
  return entry.golfer_picks.some(pick => typeof pick === 'string' ? pick.trim().length > 0 : Boolean(pick))
}

export function emptyEntryIdsForAutoRemoval<T extends EntryPickFields>(entries: T[]) {
  return entries.filter(entry => !entryHasSubmittedPicks(entry)).map(entry => entry.id).filter((id): id is string => typeof id === 'string' && id.length > 0)
}
