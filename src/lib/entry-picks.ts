export type EntryPickFields = {
  id?: string
  golfer_picks?: unknown
}

export function entryHasSubmittedPicks(entry: Pick<EntryPickFields, 'golfer_picks'>) {
  if (!Array.isArray(entry.golfer_picks)) return false
  return entry.golfer_picks.some(pick => typeof pick === 'string' ? pick.trim().length > 0 : Boolean(pick))
}

export function emptyEntryIdsForAutoRemoval<T extends EntryPickFields>(entries: T[]) {
  return entries.filter(entry => !entryHasSubmittedPicks(entry)).map(entry => entry.id).filter((id): id is string => typeof id === 'string' && id.length > 0)
}
