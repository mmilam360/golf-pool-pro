import type { GolfPlayer } from './golf-api'

function normalizedThru(value: unknown) {
  return String(value ?? '').trim().toUpperCase().replace('*', '')
}

export function playerIsOnCourse(player: Pick<GolfPlayer, 'status' | 'thru'>) {
  if (player.status && player.status !== 'active') return false
  const thru = normalizedThru(player.thru)
  if (!thru || thru === 'F' || thru === 'CUT' || thru === 'WD' || thru === 'DQ' || thru === 'DNQ') return false
  const holesPlayed = Number.parseInt(thru, 10)
  return Number.isFinite(holesPlayed) && holesPlayed > 0 && holesPlayed < 18
}

export function hasOnCourseScores(leaderboard: GolfPlayer[] | null | undefined) {
  return Array.isArray(leaderboard) && leaderboard.some(playerIsOnCourse)
}
