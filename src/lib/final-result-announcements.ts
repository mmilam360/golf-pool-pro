import type { ScoredEntry } from './scoring'

export type FinalResultAnnouncementCandidate = {
  entryId: string
  poolId: string
  poolName: string
  tournamentName: string
  isOwner?: boolean
  runItBackHref?: string
  runItBackTournamentName?: string
  rank: number | null
  totalScore: number | null
  fieldSize: number
  scoredEntries: ScoredEntry[]
}

export type FinalResultAnnouncement = FinalResultAnnouncementCandidate & {
  rank: number
  showSharePreview: boolean
}

export function selectFinalResultAnnouncement(
  candidates: FinalResultAnnouncementCandidate[],
  dismissedPoolIds: Set<string>
): FinalResultAnnouncement | null {
  for (const candidate of candidates) {
    if (!candidate.poolId || dismissedPoolIds.has(candidate.poolId)) continue
    if (!candidate.rank) continue
    return {
      ...candidate,
      rank: candidate.rank,
      showSharePreview: candidate.rank <= 5,
    }
  }

  return null
}

export function ordinal(value: number) {
  const remainder = value % 100
  if (remainder >= 11 && remainder <= 13) return `${value}th`
  switch (value % 10) {
    case 1:
      return `${value}st`
    case 2:
      return `${value}nd`
    case 3:
      return `${value}rd`
    default:
      return `${value}th`
  }
}

export function formatScore(score: number | null) {
  if (score === null) return '—'
  if (score === 0) return 'E'
  return score > 0 ? `+${score}` : String(score)
}
