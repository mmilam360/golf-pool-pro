import type { PickScore, ScoredEntry } from './scoring'

export type FrozenEntryLike = {
  id: string
  display_name?: string | null
  golfer_picks?: unknown
  counting_scores?: unknown
  total_score?: number | null
  rank?: number | null
  is_removed?: boolean | null
}

export function hasFrozenResult(entry: FrozenEntryLike) {
  return entry.total_score !== null
    && entry.total_score !== undefined
    && entry.rank !== null
    && entry.rank !== undefined
    && Array.isArray(entry.counting_scores)
}

export function buildFrozenResultEntry(entry: FrozenEntryLike): ScoredEntry {
  const storedPickScores = Array.isArray(entry.counting_scores) ? entry.counting_scores as PickScore[] : []
  return {
    entryId: entry.id,
    displayName: entry.display_name || 'Entry',
    picks: Array.isArray(entry.golfer_picks) ? entry.golfer_picks as string[] : [],
    pickScores: storedPickScores,
    totalScore: entry.total_score ?? null,
    todayScore: null,
    finalNineScore: null,
    tiebreakScores: [],
    rank: entry.rank ?? null,
    obStandIns: storedPickScores.filter(pick => pick.isObStandIn).length,
  }
}

export function frozenResultsForEntries(entries: FrozenEntryLike[]): ScoredEntry[] {
  return entries
    .filter(entry => !entry.is_removed)
    .map(buildFrozenResultEntry)
    .sort((a, b) => (a.rank ?? 999999) - (b.rank ?? 999999) || (a.totalScore ?? 999999) - (b.totalScore ?? 999999) || a.displayName.localeCompare(b.displayName))
}
