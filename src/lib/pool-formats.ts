import type { GolfPlayer } from './golf-api'
import { isUsableTournamentOddsSnapshot, type TournamentOddsSnapshot } from './tournament-odds'

export type PoolGameFormat = 'standard' | 'ranked_groups' | 'random_groups'

export type PickGroupPlayer = {
  id: string
  name: string
  rank: number | null
  rankSource?: 'odds' | 'owgr' | 'unranked'
  owgrRank?: number | null
  americanOdds?: number | null
  decimalOdds?: number | null
  impliedProbability?: number | null
  consensusProbability?: number | null
  oddsSource?: string | null
  oddsCapturedAt?: string | null
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

export function playerRanking(player: GolfPlayer | Record<string, unknown>) {
  for (const key of RANK_KEYS) {
    const rank = normalizePositiveInt((player as Record<string, unknown>)[key])
    if (rank !== null) return rank
  }
  return null
}

function normalizeNameKey(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b([a-z])\.\s*([a-z])\./g, '$1$2')
    .replace(/[’'`]/g, '')
    .replace(/[._/\\-]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function oddsByPlayer(snapshot?: TournamentOddsSnapshot | null) {
  const byId = new Map<string, TournamentOddsSnapshot['odds'][number]>()
  const byName = new Map<string, TournamentOddsSnapshot['odds'][number]>()
  if (!isUsableTournamentOddsSnapshot(snapshot)) return { byId, byName }
  for (const odd of snapshot?.odds || []) {
    if (odd.playerId) byId.set(String(odd.playerId), odd)
    const nameKey = normalizeNameKey(odd.playerName)
    if (nameKey) byName.set(nameKey, odd)
  }
  return { byId, byName }
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

function toGroupPlayer(
  player: GolfPlayer,
  index: number,
  oddsIndex?: ReturnType<typeof oddsByPlayer>,
  ranked = false
): PickGroupPlayer {
  const name = player.name || [player.firstName, player.lastName].filter(Boolean).join(' ') || `Golfer ${index + 1}`
  const id = String(player.id || name || index)
  const rank = playerRanking(player as unknown as Record<string, unknown>)
  const odd = oddsIndex?.byId.get(id) || oddsIndex?.byName.get(normalizeNameKey(name)) || null

  return {
    id,
    name,
    rank,
    owgrRank: rank,
    ...(ranked ? { rankSource: odd ? 'odds' as const : rank ? 'owgr' as const : 'unranked' as const } : {}),
    ...(odd ? {
      americanOdds: odd.americanOdds,
      decimalOdds: odd.decimalOdds,
      impliedProbability: odd.impliedProbability,
      consensusProbability: odd.consensusProbability,
      oddsSource: odd.source,
      oddsCapturedAt: odd.capturedAt,
    } : {}),
  }
}

function hasOdds(player: PickGroupPlayer) {
  return Number.isFinite(player.consensusProbability) && Number(player.consensusProbability) > 0
}

function hasRank(player: PickGroupPlayer) {
  return Number.isFinite(player.rank) && Number(player.rank) > 0
}

function rankedGroupSort(a: PickGroupPlayer, b: PickGroupPlayer) {
  const aHasOdds = hasOdds(a)
  const bHasOdds = hasOdds(b)
  if (aHasOdds || bHasOdds) {
    if (aHasOdds && !bHasOdds) return -1
    if (!aHasOdds && bHasOdds) return 1
    const oddsDelta = Number(b.consensusProbability) - Number(a.consensusProbability)
    if (oddsDelta !== 0) return oddsDelta
  }

  const aHasRank = hasRank(a)
  const bHasRank = hasRank(b)
  if (aHasRank || bHasRank) {
    if (aHasRank && !bHasRank) return -1
    if (!aHasRank && bHasRank) return 1
    const rankDelta = Number(a.rank) - Number(b.rank)
    if (rankDelta !== 0) return rankDelta
  }

  return a.name.localeCompare(b.name)
}

export function buildPickGroups({
  field,
  format,
  groupCount,
  seed,
  oddsSnapshot,
}: {
  field: GolfPlayer[]
  format: PoolGameFormat
  groupCount: number
  seed: string
  oddsSnapshot?: TournamentOddsSnapshot | null
}): PickGroup[] {
  if (format === 'standard') return []
  const oddsIndex = format === 'ranked_groups' && isUsableTournamentOddsSnapshot(oddsSnapshot, field as any[])
    ? oddsByPlayer(oddsSnapshot)
    : undefined
  const players = (Array.isArray(field) ? field : [])
    .filter(player => player?.name)
    .filter(player => String(player?.status).toLowerCase() !== 'wd')
    .map((player, index) => toGroupPlayer(player, index, oddsIndex, format === 'ranked_groups'))

  if (format === 'ranked_groups') {
    return splitEvenly(
      [...players].sort(rankedGroupSort),
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
