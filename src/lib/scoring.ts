import type { GolfPlayer } from './golf-api'

type EntryLike = { id: string; display_name: string | null; golfer_picks: unknown; is_removed?: boolean | null }

function formatScoreToPar(score: number) {
  if (score === 0) return 'E'
  return score > 0 ? `+${score}` : String(score)
}

function scoreStringToPar(score?: string | null) {
  if (!score) return null
  const normalized = String(score).trim().toUpperCase()
  if (!normalized || normalized === '-' || normalized === '—') return null
  if (normalized === 'E') return 0
  const parsed = Number(normalized.replace('+', ''))
  return Number.isFinite(parsed) ? parsed : null
}

function worstActiveRoundScore(players: GolfPlayer[], penalty: number) {
  const roundScores = players
    .map(player => scoreStringToPar(player.roundScore))
    .filter((score): score is number => score !== null)
  if (!roundScores.length) return ''
  return formatScoreToPar(Math.max(...roundScores) + penalty)
}

function tiebreakScores(player?: GolfPlayer | null): number[] {
  const completedHoles = [...(player?.roundScores || [])]
    .filter(round => round.complete && Array.isArray(round.holes) && round.holes.length >= 18)
    .sort((a, b) => a.round - b.round)
    .flatMap(round => [...(round.holes || [])].sort((a, b) => a.hole - b.hole))

  if (completedHoles.length < 9) return []

  const scores: number[] = []
  for (let holeCount = 9; holeCount <= completedHoles.length; holeCount += 9) {
    scores.push(completedHoles.slice(-holeCount).reduce((sum, hole) => sum + hole.scoreToPar, 0))
  }
  return scores
}

function worstActiveTiebreakScores(players: GolfPlayer[], penalty: number) {
  const playerScores = players.map(player => tiebreakScores(player))
  const maxLength = Math.max(0, ...playerScores.map(scores => scores.length))
  const scores: number[] = []
  for (let index = 0; index < maxLength; index += 1) {
    const levelScores = playerScores
      .map(playerScore => playerScore[index])
      .filter((score): score is number => Number.isFinite(score))
    if (!levelScores.length) break
    scores.push(Math.max(...levelScores) + penalty)
  }
  return scores
}

export interface PickScore {
  name: string; scoreToPar: number | null; strokes: number | null
  thru: string; status: 'active' | 'cut' | 'wd' | 'dnq'
  counted: boolean; isObStandIn: boolean
  teeTime?: string; startTee?: number | null; roundScore?: string; finalNineScore?: number | null; tiebreakScores?: number[]
}

export interface ScoredEntry {
  entryId: string; displayName: string; picks: string[]
  pickScores: PickScore[]; totalScore: number | null; todayScore: number | null
  finalNineScore: number | null; tiebreakScores: number[]; rank: number | null; obStandIns: number
}

export type LeveragePickMap = Map<string, Set<string>>
export type HorsePickMap = LeveragePickMap

export function normalizePickName(name: string) {
  return name.trim().toLowerCase()
}

export function scoreEntry(
  picks: string[], leaderboard: GolfPlayer[],
  options: { countScores: number; obRuleEnabled: boolean; obPenaltyStrokes: number }
): ScoredEntry {
  const { countScores, obRuleEnabled, obPenaltyStrokes } = options
  const pickScores: PickScore[] = picks.map(name => {
    const player = leaderboard.find(p =>
      p.name.toLowerCase() === name.toLowerCase() ||
      `${p.firstName} ${p.lastName}`.toLowerCase() === name.toLowerCase()
    )
    if (!player) return { name, scoreToPar: null, strokes: null, thru: '', status: 'dnq' as const, counted: false, isObStandIn: false, finalNineScore: null, tiebreakScores: [] }
    const playerTiebreakScores = tiebreakScores(player)
    return { name: player.name, scoreToPar: player.scoreToPar, strokes: player.strokes, thru: player.thru, status: player.status, counted: false, isObStandIn: false, teeTime: player.teeTime, startTee: player.startTee, roundScore: player.roundScore, finalNineScore: playerTiebreakScores[0] ?? null, tiebreakScores: playerTiebreakScores }
  })

  const active = pickScores.filter(p => p.status === 'active' && p.scoreToPar !== null)
  active.sort((a, b) => (a.scoreToPar ?? 999) - (b.scoreToPar ?? 999))

  let counting: PickScore[] = []; let obStandIns = 0
  if (active.length >= countScores) {
    counting = active.slice(0, countScores)
  } else {
    counting = [...active]
    const needed = countScores - active.length
    const obEligiblePicks = pickScores.filter(p => p.status !== 'active')
    const standInsNeeded = Math.min(needed, obEligiblePicks.length)
    if (standInsNeeded > 0 && leaderboard.length > 0) {
      const scoredPlayers = leaderboard.filter(p => p.status === 'active' && p.scoreToPar !== null)
      scoredPlayers.sort((a, b) => (b.scoreToPar ?? -999) - (a.scoreToPar ?? -999))
      const worstScore = scoredPlayers.length > 0 ? (scoredPlayers[0].scoreToPar ?? 0) : 0
      const standInPenalty = obRuleEnabled ? obPenaltyStrokes : 0
      const obRoundScore = worstActiveRoundScore(scoredPlayers, standInPenalty)
      const obTiebreakScores = worstActiveTiebreakScores(scoredPlayers, standInPenalty)
      const standInPicks = obEligiblePicks.slice(0, standInsNeeded)
      for (const pick of standInPicks) {
        counting.push({
          ...pick,
          scoreToPar: worstScore + standInPenalty,
          strokes: null,
          thru: '',
          roundScore: obRoundScore,
          finalNineScore: obTiebreakScores[0] ?? null,
          tiebreakScores: obTiebreakScores,
          counted: true,
          isObStandIn: true,
        })
      }
      obStandIns = standInsNeeded
    }
  }
  counting.forEach(p => p.counted = true)
  const replacedObNames = new Set(counting.filter(p => p.isObStandIn).map(p => normalizePickName(p.name)))
  const allScored = [
    ...counting,
    ...active.filter(p => !p.counted),
    ...pickScores.filter(p => p.status !== 'active' && !replacedObNames.has(normalizePickName(p.name))),
  ]
  const totalScore = counting.length >= countScores ? counting.reduce((s, p) => s + (p.scoreToPar ?? 0), 0) : null
  const todayScores = counting.map(p => scoreStringToPar(p.roundScore))
  const todayScore = counting.length >= countScores && todayScores.every(score => score !== null)
    ? todayScores.reduce((sum, score) => sum + (score ?? 0), 0)
    : null
  const maxTiebreakLevels = Math.max(0, ...counting.map(p => p.tiebreakScores?.length || 0))
  const teamTiebreakScores: number[] = []
  if (counting.length >= countScores) {
    for (let index = 0; index < maxTiebreakLevels; index += 1) {
      const scores = counting.map(p => p.tiebreakScores?.[index])
      if (!scores.every(score => Number.isFinite(score))) break
      teamTiebreakScores.push(scores.reduce((sum, score) => sum + (score ?? 0), 0))
    }
  }
  return { entryId: '', displayName: '', picks, pickScores: allScored, totalScore, todayScore, finalNineScore: teamTiebreakScores[0] ?? null, tiebreakScores: teamTiebreakScores, rank: null, obStandIns }
}

export function availableCompletedRounds(leaderboard: GolfPlayer[]) {
  const players = Array.isArray(leaderboard) ? leaderboard : []
  const rounds = new Set<number>()
  for (const player of players) {
    for (const round of player.roundScores || []) {
      if (round.complete) rounds.add(round.round)
    }
  }

  return Array.from(rounds)
    .filter(roundNumber => players
      .filter(player => player.status === 'active')
      .every(player => player.roundScores?.some(round => round.round === roundNumber && round.complete))
    )
    .sort((a, b) => a - b)
}

function inactiveRoundPlayer(player: GolfPlayer): GolfPlayer {
  return {
    ...player,
    score: player.status === 'wd' ? 'WD' : player.status === 'dnq' ? 'DNQ' : 'CUT',
    scoreToPar: player.scoreToPar,
    thru: '',
    roundScore: '',
    position: player.status === 'wd' ? 'WD' : player.status === 'dnq' ? 'DNQ' : 'CUT',
    status: player.status === 'wd' || player.status === 'dnq' ? player.status : 'cut' as const,
  }
}

export function leaderboardForCompletedRound(leaderboard: GolfPlayer[], roundNumber: number): GolfPlayer[] {
  return (Array.isArray(leaderboard) ? leaderboard : [])
    .map(player => {
      const round = player.roundScores?.find(item => item.round === roundNumber)
      if (!round?.complete) return inactiveRoundPlayer(player)
      return {
        ...player,
        score: formatScoreToPar(round.cumulativeScoreToPar),
        scoreToPar: round.cumulativeScoreToPar,
        thru: 'F',
        roundScore: formatScoreToPar(round.roundScoreToPar),
        position: '',
        status: 'active' as const,
      }
    })
}

export function leaderboardForRoundOnly(leaderboard: GolfPlayer[], roundNumber: number): GolfPlayer[] {
  return (Array.isArray(leaderboard) ? leaderboard : [])
    .map(player => {
      const round = player.roundScores?.find(item => item.round === roundNumber)
      if (!round?.complete) return inactiveRoundPlayer(player)
      return {
        ...player,
        score: formatScoreToPar(round.roundScoreToPar),
        scoreToPar: round.roundScoreToPar,
        thru: 'F',
        roundScore: formatScoreToPar(round.roundScoreToPar),
        position: '',
        status: 'active' as const,
      }
    })
}

export function scoreEntriesForLeaderboard(
  entries: EntryLike[],
  leaderboard: GolfPlayer[],
  options: { countScores: number; obRuleEnabled: boolean; obPenaltyStrokes: number }
): ScoredEntry[] {
  return rankEntries(
    entries
      .filter(entry => !entry.is_removed)
      .map(entry => ({
        ...scoreEntry((entry.golfer_picks as string[]) || [], leaderboard, options),
        entryId: entry.id,
        displayName: entry.display_name || 'Player',
      }))
  )
}

export function rankEntries(entries: ScoredEntry[]): ScoredEntry[] {
  const ranked = [...entries].sort((a, b) => {
    if (a.totalScore === null && b.totalScore === null) return 0
    if (a.totalScore === null) return 1; if (b.totalScore === null) return -1
    const totalDiff = a.totalScore - b.totalScore
    if (totalDiff !== 0) return totalDiff
    return compareTiebreakScores(a, b)
  })
  ranked.forEach((e, i) => {
    if (e.totalScore === null) {
      e.rank = null
    } else if (i === 0 || ranked[i - 1].totalScore === null) {
      e.rank = 1
    } else if (e.totalScore === ranked[i - 1].totalScore && compareTiebreakScores(e, ranked[i - 1]) === 0) {
      e.rank = ranked[i - 1].rank
    } else {
      e.rank = i + 1
    }
  })
  return ranked
}

function compareTiebreakScores(a: ScoredEntry, b: ScoredEntry) {
  const maxLength = Math.max(a.tiebreakScores?.length || 0, b.tiebreakScores?.length || 0)
  for (let index = 0; index < maxLength; index += 1) {
    const aScore = a.tiebreakScores?.[index]
    const bScore = b.tiebreakScores?.[index]
    if (!Number.isFinite(aScore) && !Number.isFinite(bScore)) continue
    if (!Number.isFinite(aScore)) return 1
    if (!Number.isFinite(bScore)) return -1
    const diff = (aScore as number) - (bScore as number)
    if (diff !== 0) return diff
  }
  return 0
}

function realEntries(entries: ScoredEntry[]) {
  return entries.filter(entry => !entry.picks.includes('__hidden__') && entry.pickScores.some(pick => !pick.isObStandIn && pick.name !== 'Picks hidden'))
}

function ownershipByPick(entries: ScoredEntry[]) {
  const ownership = new Map<string, number>()
  for (const entry of entries) {
    const entryPickNames = new Set(
      entry.pickScores
        .filter(pick => !pick.isObStandIn && pick.name && pick.name !== 'Picks hidden')
        .map(pick => normalizePickName(pick.name))
    )
    entryPickNames.forEach(name => ownership.set(name, (ownership.get(name) || 0) + 1))
  }
  return ownership
}

export function buildHarePickMap(entries: ScoredEntry[], maxPerEntry = 2): LeveragePickMap {
  const poolEntries = realEntries(entries)
  if (poolEntries.length < 3) return new Map()
  const ownership = ownershipByPick(poolEntries)
  const harePicks: LeveragePickMap = new Map()

  for (const entry of poolEntries) {
    const candidates = entry.pickScores
      .filter(pick => !pick.isObStandIn && pick.name && pick.name !== 'Picks hidden')
      .map(pick => {
        const key = normalizePickName(pick.name)
        const ownerCount = ownership.get(key) || poolEntries.length
        const uniqueness = 1 - ownerCount / poolEntries.length
        const uniqueBonus = ownerCount === 1 ? 0.45 : 0
        const countingBonus = pick.counted ? 0.35 : 0
        const closeBonus = !pick.counted && pick.scoreToPar !== null && pick.status === 'active' ? 0.12 : 0
        const deadPenalty = pick.status === 'cut' || pick.status === 'wd' || pick.status === 'dnq' ? 0.35 : 0
        return { key, score: uniqueness + uniqueBonus + countingBonus + closeBonus - deadPenalty }
      })
      .filter(candidate => candidate.score >= 1.05)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, Math.min(maxPerEntry, 2)))

    if (candidates.length) harePicks.set(entry.entryId, new Set(candidates.map(candidate => candidate.key)))
  }

  return harePicks
}

export function buildTortoisePickMap(entries: ScoredEntry[], viewerEntryId?: string | null, maxPerEntry = 2): LeveragePickMap {
  if (!viewerEntryId) return new Map()
  const poolEntries = realEntries(entries)
  if (poolEntries.length < 3) return new Map()
  const viewerEntry = poolEntries.find(entry => entry.entryId === viewerEntryId)
  if (!viewerEntry) return new Map()

  const viewerPickNames = new Set(viewerEntry.pickScores.map(pick => normalizePickName(pick.name)))
  const ownership = ownershipByPick(poolEntries)
  const tortoisePicks: LeveragePickMap = new Map()

  for (const entry of poolEntries) {
    if (entry.entryId === viewerEntryId) continue
    const candidates = entry.pickScores
      .filter(pick => !pick.isObStandIn && pick.name && pick.name !== 'Picks hidden' && !viewerPickNames.has(normalizePickName(pick.name)))
      .map(pick => {
        const key = normalizePickName(pick.name)
        const ownerCount = ownership.get(key) || poolEntries.length
        const uniqueness = 1 - ownerCount / poolEntries.length
        const uniqueBonus = ownerCount === 1 ? 0.35 : 0
        const countingBonus = pick.counted ? 0.45 : 0
        const closeBonus = !pick.counted && pick.scoreToPar !== null && pick.status === 'active' ? 0.14 : 0
        const scorePressure = pick.scoreToPar !== null ? Math.max(0, 8 - pick.scoreToPar) / 20 : 0
        const deadPenalty = pick.status === 'cut' || pick.status === 'wd' || pick.status === 'dnq' ? 0.5 : 0
        return { key, score: uniqueness + uniqueBonus + countingBonus + closeBonus + scorePressure - deadPenalty }
      })
      .filter(candidate => candidate.score >= 1.05)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, Math.min(maxPerEntry, 2)))

    if (candidates.length) tortoisePicks.set(entry.entryId, new Set(candidates.map(candidate => candidate.key)))
  }

  return tortoisePicks
}

export const buildHorsePickMap = buildHarePickMap
export const buildTurtlePickMap = buildTortoisePickMap
