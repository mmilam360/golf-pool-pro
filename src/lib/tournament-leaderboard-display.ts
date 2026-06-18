import type { GolfPlayer } from './golf-api'
import { playerIsOnCourse } from './golf-live'

type LeaderboardPlayer = Pick<GolfPlayer, 'status' | 'thru' | 'roundScore' | 'scoreToPar' | 'position' | 'teeTime'>

function normalizedStatus(player: LeaderboardPlayer) {
  return String(player.status || '').trim().toLowerCase()
}

function normalizedThru(player: LeaderboardPlayer) {
  return String(player.thru ?? '').trim().toUpperCase().replace('*', '')
}

function parsedTeeTime(player: LeaderboardPlayer) {
  if (!player.teeTime) return null
  const parsed = new Date(player.teeTime)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

function isInactive(player: LeaderboardPlayer) {
  return ['cut', 'wd', 'dnq', 'dq'].includes(normalizedStatus(player))
}

export function tournamentPlayerHasStarted(player: LeaderboardPlayer, now = new Date()) {
  if (isInactive(player)) return true
  if (String(player.roundScore ?? '').trim()) return true

  const thru = normalizedThru(player)
  if (thru && thru !== '-' && thru !== '—' && !['CUT', 'WD', 'DQ', 'DNQ'].includes(thru)) return true

  const teeTime = parsedTeeTime(player)
  return Boolean(teeTime && teeTime.getTime() <= now.getTime())
}

export function tournamentPlayerNotStarted(player: LeaderboardPlayer, now = new Date()) {
  return !isInactive(player) && !tournamentPlayerHasStarted(player, now)
}

function leaderboardSortBucket(player: GolfPlayer, now: Date) {
  if (isInactive(player)) return 3
  if (playerIsOnCourse(player)) return 0
  if (tournamentPlayerHasStarted(player, now)) return 1
  return 2
}

function scoreSortValue(player: GolfPlayer, now: Date) {
  return tournamentPlayerNotStarted(player, now) ? 999 : player.scoreToPar ?? 999
}

function teeTimeSortValue(player: GolfPlayer) {
  return parsedTeeTime(player)?.getTime() ?? Number.MAX_SAFE_INTEGER
}

export function sortTournamentLeaderboardRows(rows: GolfPlayer[], now = new Date()) {
  return [...rows].sort((a, b) => {
    const bucketDiff = leaderboardSortBucket(a, now) - leaderboardSortBucket(b, now)
    if (bucketDiff !== 0) return bucketDiff

    const scoreDiff = scoreSortValue(a, now) - scoreSortValue(b, now)
    if (scoreDiff !== 0) return scoreDiff

    return teeTimeSortValue(a) - teeTimeSortValue(b)
  })
}

export function tournamentScoreLabel(player: LeaderboardPlayer, now = new Date()) {
  if (tournamentPlayerNotStarted(player, now)) return ''
  const score = player.scoreToPar
  if (score == null) return '—'
  if (score === 0) return 'E'
  return score > 0 ? `+${score}` : String(score)
}

export function tournamentScoreClass(player: LeaderboardPlayer, now = new Date()) {
  if (tournamentPlayerNotStarted(player, now)) return 'text-[#657168]'
  const score = player.scoreToPar
  if (score == null) return 'text-[#657168]'
  return score < 0 ? 'text-[#b21e23]' : 'text-[#1f2a24]'
}

export function tournamentPositionLabel(player: LeaderboardPlayer, index: number, now = new Date()) {
  if (tournamentPlayerNotStarted(player, now)) return ''
  const raw = String(player.position || '').trim()
  if (raw) return raw
  return String(index + 1)
}
