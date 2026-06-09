import { getLeaderboard, type GolfPlayer } from '@/lib/golf-api'
import { hasWeekendCutStatusErrors, repairWeekendCutStatuses } from '@/lib/leaderboard-sanity'

export type TournamentWithLeaderboard = {
  external_id?: string | null
  status?: string | null
  leaderboard_json?: GolfPlayer[] | null
  field_json?: GolfPlayer[] | null
}

export async function hydrateFinalLeaderboard<T extends TournamentWithLeaderboard | null | undefined>(tournament: T): Promise<T> {
  if (!tournament?.external_id) return tournament
  if (tournament.status !== 'completed' && !hasWeekendCutStatusErrors(tournament.leaderboard_json)) return tournament

  try {
    const fresh = await getLeaderboard(tournament.external_id)
    if (!fresh?.leaderboard?.length) return tournament
    const leaderboard = repairWeekendCutStatuses(fresh.leaderboard)
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
