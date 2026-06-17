import type { GolfPlayer } from '@/lib/golf-api'

export function hasPostCutRoundEvidence(player: Pick<GolfPlayer, 'roundScores' | 'thru' | 'roundScore'> | any) {
  const rounds = Array.isArray(player?.roundScores) ? player.roundScores : []
  return rounds.some((round: any) => Number(round?.round) >= 3)
    || Boolean(String(player?.thru || '').trim())
    || Boolean(String(player?.roundScore || '').trim())
}

export function hasWeekendCutStatusErrors(players: GolfPlayer[] | null | undefined) {
  if (!Array.isArray(players)) return false
  return players.some(player => String(player?.status || '').toLowerCase() === 'cut' && hasPostCutRoundEvidence(player))
}

export function repairWeekendCutStatuses<T extends Record<string, any>>(players: T[] | null | undefined): T[] {
  if (!Array.isArray(players)) return []
  return players.map(player => {
    if (String(player?.status || '').toLowerCase() !== 'cut') return player
    if (!hasPostCutRoundEvidence(player)) return player
    return { ...player, status: 'active' }
  })
}

export function weekendCutStatusErrorNames(players: GolfPlayer[] | null | undefined) {
  if (!Array.isArray(players)) return []
  return players
    .filter(player => String(player?.status || '').toLowerCase() === 'cut' && hasPostCutRoundEvidence(player))
    .map(player => player.name)
    .filter(Boolean)
}

export function latestScorecardRound(players: GolfPlayer[] | null | undefined) {
  if (!Array.isArray(players)) return 0
  const rounds = players.flatMap(player =>
    (Array.isArray(player?.roundScores) ? player.roundScores : [])
      .map((round: any) => Number(round?.round))
      .filter(Number.isFinite)
  )
  return Math.max(0, ...rounds)
}

export function completedScoringRound(players: GolfPlayer[] | null | undefined, reportedRound?: number | null) {
  const leaderboard = Array.isArray(players) ? players : []
  const activePlayers = leaderboard.filter(player => player?.status === 'active')
  const reported = Number(reportedRound || 0)
  const latest = latestScorecardRound(activePlayers)
  const hasReportedRound = reported > 0 && activePlayers.some(player =>
    (Array.isArray(player?.roundScores) ? player.roundScores : []).some((round: any) => Number(round?.round) === reported)
  )
  return hasReportedRound ? reported : latest
}

export function finalBoardLooksComplete(players: GolfPlayer[] | null | undefined, reportedRound?: number | null) {
  const leaderboard = Array.isArray(players) ? players : []
  const activePlayers = leaderboard.filter(player => player?.status === 'active')
  if (activePlayers.length === 0) return false
  const scoringRound = completedScoringRound(activePlayers, reportedRound)
  if (scoringRound < 4) return false
  return activePlayers.every(player => {
    if (String(player?.thru || '').toUpperCase() === 'F') return true
    const finalRound = Array.isArray(player?.roundScores)
      ? player.roundScores.find((round: any) => Number(round?.round) === scoringRound)
      : null
    return Boolean(finalRound?.complete)
  })
}

function activePlayersHaveScores(players: GolfPlayer[] | null | undefined) {
  const leaderboard = Array.isArray(players) ? players : []
  const activePlayers = leaderboard.filter(player => player?.status === 'active')
  return activePlayers.length > 0 && activePlayers.every(player =>
    player.scoreToPar !== null
      && player.scoreToPar !== undefined
      && Number.isFinite(Number(player.scoreToPar))
  )
}

export function finalBoardHasEnoughEvidence(players: GolfPlayer[] | null | undefined, reportedRound?: number | null) {
  return finalBoardLooksComplete(players, reportedRound)
    && activePlayersHaveScores(players)
    && !hasWeekendCutStatusErrors(players)
}
