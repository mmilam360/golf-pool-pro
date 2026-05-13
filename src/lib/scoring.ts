import type { GolfPlayer } from './golf-api'

export interface PickScore {
  name: string; scoreToPar: number | null; strokes: number | null
  thru: string; status: 'active' | 'cut' | 'wd' | 'dnq'
  counted: boolean; isObStandIn: boolean
}

export interface ScoredEntry {
  entryId: string; displayName: string; picks: string[]
  pickScores: PickScore[]; totalScore: number | null
  rank: number | null; obStandIns: number
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
    if (!player) return { name, scoreToPar: null, strokes: null, thru: '', status: 'dnq' as const, counted: false, isObStandIn: false }
    return { name: player.name, scoreToPar: player.scoreToPar, strokes: player.strokes, thru: player.thru, status: player.status, counted: false, isObStandIn: false }
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
    if (obRuleEnabled && standInsNeeded > 0 && leaderboard.length > 0) {
      const scoredPlayers = leaderboard.filter(p => p.status === 'active' && p.scoreToPar !== null)
      scoredPlayers.sort((a, b) => (b.scoreToPar ?? -999) - (a.scoreToPar ?? -999))
      const worstScore = scoredPlayers.length > 0 ? scoredPlayers[0].scoreToPar : 0
      for (let i = 0; i < standInsNeeded; i++) {
        counting.push({ name: `OB Stand-in #${i + 1}`, scoreToPar: worstScore + obPenaltyStrokes, strokes: null, thru: 'F', status: 'active', counted: true, isObStandIn: true })
      }
      obStandIns = standInsNeeded
    }
  }
  counting.forEach(p => p.counted = true)
  const allScored = [...counting, ...active.filter(p => !p.counted), ...pickScores.filter(p => p.status !== 'active')]
  const totalScore = counting.length >= countScores ? counting.reduce((s, p) => s + (p.scoreToPar ?? 0), 0) : null
  return { entryId: '', displayName: '', picks, pickScores: allScored, totalScore, rank: null, obStandIns }
}

export function rankEntries(entries: ScoredEntry[]): ScoredEntry[] {
  const ranked = [...entries].sort((a, b) => {
    if (a.totalScore === null && b.totalScore === null) return 0
    if (a.totalScore === null) return 1; if (b.totalScore === null) return -1
    return a.totalScore - b.totalScore
  })
  ranked.forEach((e, i) => {
    if (e.totalScore === null) {
      e.rank = null
    } else if (i === 0 || ranked[i - 1].totalScore === null) {
      e.rank = 1
    } else if (e.totalScore === ranked[i - 1].totalScore) {
      e.rank = ranked[i - 1].rank
    } else {
      e.rank = i + 1
    }
  })
  return ranked
}
