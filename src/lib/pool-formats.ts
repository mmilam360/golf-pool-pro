import type { GolfPlayer } from './golf-api'

export type PoolGameFormat = 'standard' | 'ranked_groups' | 'random_groups'

export type PickGroupPlayer = {
  id: string
  name: string
  rank: number | null
}

export type PickGroup = {
  id: string
  label: string
  players: PickGroupPlayer[]
}

export type GroupedPoolSettings = {
  groupCount: number
  picksPerGroup: number
}

const RANK_KEYS = [
  'owgrRank',
  'owgr_rank',
  'worldRank',
  'world_rank',
  'worldGolfRank',
  'world_golf_rank',
  'rank',
  'ranking',
  'owgr',
]

function normalizePositiveInt(value: unknown) {
  const number = typeof value === 'number' ? value : Number(String(value || '').replace(/[^0-9]/g, ''))
  return Number.isFinite(number) && number > 0 ? number : null
}

export function playerRanking(player: GolfPlayer | Record<string, unknown>, fallbackRank: number) {
  for (const key of RANK_KEYS) {
    const rank = normalizePositiveInt((player as Record<string, unknown>)[key])
    if (rank !== null) return rank
  }
  return fallbackRank
}

function seededRandom(seed: string) {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return () => {
    hash += 0x6D2B79F5
    let value = hash
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function splitEvenly(players: PickGroupPlayer[], groupCount: number) {
  const safeGroupCount = Math.max(1, Math.min(groupCount, players.length || groupCount))
  const baseSize = Math.floor(players.length / safeGroupCount)
  const remainder = players.length % safeGroupCount
  let cursor = 0

  return Array.from({ length: safeGroupCount }, (_, index) => {
    const groupSize = baseSize + (index < remainder ? 1 : 0)
    const groupPlayers = players.slice(cursor, cursor + groupSize)
    cursor += groupSize
    return {
      id: `group-${index + 1}`,
      label: `Group ${index + 1}`,
      players: groupPlayers,
    }
  })
}

function toGroupPlayer(player: GolfPlayer, index: number): PickGroupPlayer {
  return {
    id: String(player.id || player.name || index),
    name: player.name || [player.firstName, player.lastName].filter(Boolean).join(' ') || `Golfer ${index + 1}`,
    rank: playerRanking(player as unknown as Record<string, unknown>, index + 1),
  }
}

export function buildPickGroups({
  field,
  format,
  groupCount,
  seed,
}: {
  field: GolfPlayer[]
  format: PoolGameFormat
  groupCount: number
  seed: string
}): PickGroup[] {
  if (format === 'standard') return []
  const players = (Array.isArray(field) ? field : [])
    .filter(player => player?.name)
    .map(toGroupPlayer)

  if (format === 'ranked_groups') {
    return splitEvenly(
      [...players].sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999) || a.name.localeCompare(b.name)),
      groupCount
    )
  }

  const random = seededRandom(seed)
  return splitEvenly(
    [...players].sort(() => random() - 0.5),
    groupCount
  )
}

export function groupForPick(groups: PickGroup[], golferName: string) {
  const normalized = golferName.trim().toLowerCase()
  return groups.find(group => group.players.some(player => player.name.trim().toLowerCase() === normalized)) || null
}

export function groupPickCounts(groups: PickGroup[], picks: string[]) {
  return groups.map(group => ({
    group,
    picks: picks.filter(pick => group.players.some(player => player.name.trim().toLowerCase() === pick.trim().toLowerCase())),
  }))
}

export function validateGroupedPicks(groups: PickGroup[], picks: string[], picksPerGroup: number) {
  const counts = groupPickCounts(groups, picks)
  const missing = counts.filter(item => item.picks.length < picksPerGroup)
  const over = counts.filter(item => item.picks.length > picksPerGroup)
  return {
    valid: groups.length > 0 && missing.length === 0 && over.length === 0,
    missing,
    over,
  }
}

export function orderedPicksByGroup(groups: PickGroup[], picks: string[]) {
  const grouped = groupPickCounts(groups, picks).flatMap(item => item.picks)
  const groupedNames = new Set(grouped.map(name => name.trim().toLowerCase()))
  const leftovers = picks.filter(name => !groupedNames.has(name.trim().toLowerCase())).sort((a, b) => a.localeCompare(b))
  return [...grouped, ...leftovers]
}
