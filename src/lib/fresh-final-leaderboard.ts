import { getLeaderboard, type GolfPlayer } from '@/lib/golf-api'

export type TournamentWithLeaderboard = {
  external_id?: string | null
  status?: string | null
  leaderboard_json?: GolfPlayer[] | null
  field_json?: GolfPlayer[] | null
}

function hasWeekendCutStatusErrors(players: GolfPlayer[] | null | undefined) {
  if (!Array.isArray(players)) return false
  return players.some(player => {
    if (String(player.status || '').toLowerCase() !== 'cut') return false
    return (player.roundScores || []).some(round =>
      Number(round.round) >= 3 && (Boolean(round.complete) || (Array.isArray(round.holes) && round.holes.length > 0))
    )
  })
}

export async function hydrateFinalLeaderboard<T extends TournamentWithLeaderboard | null | undefined>(tournament: T): Promise<T> {
  if (!tournament?.external_id) return tournament
  if (tournament.status !== 'completed' && !hasWeekendCutStatusErrors(tournament.leaderboard_json)) return tournament

  try {
    const fresh = await getLeaderboard(tournament.external_id)
    if (!fresh?.leaderboard?.length) return tournament
    return {
      ...tournament,
      leaderboard_json: fresh.leaderboard,
      field_json: Array.isArray(tournament.field_json) && tournament.field_json.length > 0 ? tournament.field_json : fresh.leaderboard,
    }
  } catch {
    return tournament
  }
}

export async function hydrateFinalLeaderboards<T extends TournamentWithLeaderboard>(tournaments: T[]) {
  return Promise.all(tournaments.map(tournament => hydrateFinalLeaderboard(tournament)))
}
