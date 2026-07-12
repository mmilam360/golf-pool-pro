import { getLeaderboard, type GolfPlayer } from '@/lib/golf-api'
import {
  finalBoardHasEnoughEvidence,
  hasUsablePlayerIdentities,
  hasWeekendCutStatusErrors,
  preferredStoredLeaderboard,
  repairWeekendCutStatuses,
} from '@/lib/leaderboard-sanity'

export type TournamentWithLeaderboard = {
  external_id?: string | null
  status?: string | null
  leaderboard_json?: GolfPlayer[] | null
  field_json?: GolfPlayer[] | null
}

type LeaderboardLoader = typeof getLeaderboard

export async function hydrateFinalLeaderboard<T extends TournamentWithLeaderboard | null | undefined>(
  tournament: T,
  loadLeaderboard: LeaderboardLoader = getLeaderboard,
): Promise<T> {
  if (!tournament?.external_id) return tournament
  const storedLeaderboard = Array.isArray(tournament.leaderboard_json) ? tournament.leaderboard_json : []

  if (tournament.status === 'completed') {
    const repairedStoredLeaderboard = hasWeekendCutStatusErrors(storedLeaderboard)
      ? repairWeekendCutStatuses(storedLeaderboard)
      : storedLeaderboard
    const preferredLeaderboard = preferredStoredLeaderboard(
      tournament.status,
      repairedStoredLeaderboard,
      tournament.field_json,
    )
    if (finalBoardHasEnoughEvidence(preferredLeaderboard)) {
      return {
        ...tournament,
        leaderboard_json: preferredLeaderboard,
        field_json: Array.isArray(tournament.field_json) && tournament.field_json.length > 0
          ? tournament.field_json
          : preferredLeaderboard,
      }
    }
  } else if (!hasWeekendCutStatusErrors(storedLeaderboard)) {
    return tournament
  }

  try {
    const fresh = await loadLeaderboard(tournament.external_id)
    if (!fresh?.leaderboard?.length) return tournament
    const leaderboard = repairWeekendCutStatuses(fresh.leaderboard)
    if (!hasUsablePlayerIdentities(leaderboard)) return tournament
    if (tournament.status === 'completed' && !finalBoardHasEnoughEvidence(leaderboard)) return tournament
    return {
      ...tournament,
      leaderboard_json: leaderboard,
      field_json: Array.isArray(tournament.field_json) && tournament.field_json.length > 0 ? tournament.field_json : leaderboard,
    }
  } catch {
    return tournament
  }
}

export async function hydrateFinalLeaderboards<T extends TournamentWithLeaderboard>(tournaments: T[]) {
  return Promise.all(tournaments.map(tournament => hydrateFinalLeaderboard(tournament)))
}
