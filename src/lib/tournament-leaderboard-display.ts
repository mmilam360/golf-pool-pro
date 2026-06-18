import type { GolfPlayer } from './golf-api'

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

function playerIdentity(player: GolfPlayer) {
  const id = String(player.id || '').trim()
  if (id) return `id:${id}`
  return `name:${String(player.name || '').trim().toLowerCase().replace(/\s+/g, ' ')}`
}

function officialPositionSortValue(player: LeaderboardPlayer) {
  const raw = String(player.position || '').trim()
  const match = raw.match(/\d+/)
  if (!match) return Number.MAX_SAFE_INTEGER
  const value = Number.parseInt(match[0], 10)
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER
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
  if (tournamentPlayerHasStarted(player, now)) return 0
  return 1
}

function scoreSortValue(player: GolfPlayer, now: Date) {
  return tournamentPlayerNotStarted(player, now) ? 999 : player.scoreToPar ?? 999
}

function teeTimeSortValue(player: GolfPlayer) {
  return parsedTeeTime(player)?.getTime() ?? Number.MAX_SAFE_INTEGER
}

export function sortTournamentLeaderboardRows(rows: GolfPlayer[], now = new Date()) {
  const seen = new Set<string>()
  const uniqueRows = rows.filter(player => {
    const identity = playerIdentity(player)
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })

  return uniqueRows.sort((a, b) => {
    const bucketDiff = leaderboardSortBucket(a, now) - leaderboardSortBucket(b, now)
    if (bucketDiff !== 0) return bucketDiff

    const scoreDiff = scoreSortValue(a, now) - scoreSortValue(b, now)
    if (scoreDiff !== 0) return scoreDiff

    const positionDiff = officialPositionSortValue(a) - officialPositionSortValue(b)
    if (positionDiff !== 0) return positionDiff

    const teeTimeDiff = teeTimeSortValue(a) - teeTimeSortValue(b)
    if (teeTimeDiff !== 0) return teeTimeDiff

    return String(a.name || '').localeCompare(String(b.name || ''))
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
