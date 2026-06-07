import { readFileSync } from 'node:fs'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function finalRoundLooksComplete(players, round) {
  const reportedRound = Number(round || 0)
  if (reportedRound < 4) return false
  const activePlayers = players.filter(player => player?.status === 'active')
  if (activePlayers.length === 0) return false

  const activeRounds = activePlayers.flatMap(player =>
    (Array.isArray(player?.roundScores) ? player.roundScores : [])
      .map(score => Number(score?.round))
      .filter(Number.isFinite)
  )
  const latestScorecardRound = Math.max(0, ...activeRounds)
  const scoringRound = activePlayers.some(player =>
    (Array.isArray(player?.roundScores) ? player.roundScores : []).some(score => Number(score?.round) === reportedRound)
  )
    ? reportedRound
    : latestScorecardRound

  if (scoringRound < 4) return false

  return activePlayers.every(player => {
    if (String(player?.thru || '').toUpperCase() === 'F') return true
    const finalRound = Array.isArray(player?.roundScores)
      ? player.roundScores.find(score => Number(score?.round) === scoringRound)
      : null
    return Boolean(finalRound?.complete)
  })
}

const regulationPlayers = [
  {
    name: 'No Thru But Done',
    status: 'active',
    thru: '',
    roundScores: [
      { round: 1, complete: true },
      { round: 2, complete: true },
      { round: 3, complete: true },
      { round: 4, complete: true },
    ],
  },
  {
    name: 'Finished Label',
    status: 'active',
    thru: 'F',
    roundScores: [
      { round: 1, complete: true },
      { round: 2, complete: true },
      { round: 3, complete: true },
      { round: 4, complete: true },
    ],
  },
  {
    name: 'Missed Cut',
    status: 'cut',
    thru: '',
    roundScores: [
      { round: 1, complete: true },
      { round: 2, complete: true },
    ],
  },
]

const playoffPlayers = [
  {
    name: 'Playoff Winner',
    status: 'active',
    thru: '',
    roundScores: [
      { round: 1, complete: true },
      { round: 2, complete: true },
      { round: 3, complete: true },
      { round: 4, complete: true },
      { round: 5, complete: true },
    ],
  },
  {
    name: 'Playoff Runner Up',
    status: 'active',
    thru: '',
    roundScores: [
      { round: 1, complete: true },
      { round: 2, complete: true },
      { round: 3, complete: true },
      { round: 4, complete: true },
      { round: 5, complete: true },
    ],
  },
]

assert(finalRoundLooksComplete(regulationPlayers, 4), 'round 4 should be complete when active players have complete round 4 scores')
assert(finalRoundLooksComplete(regulationPlayers, 5), 'ESPN round 5 status with no round 5 scorecards should fall back to complete round 4')
assert(finalRoundLooksComplete(playoffPlayers, 5), 'actual round 5/playoff scorecards must be included when ESPN provides them')
assert(!finalRoundLooksComplete([{ ...playoffPlayers[0], roundScores: [{ round: 5, complete: false }] }], 5), 'incomplete playoff round should not be final')
assert(!finalRoundLooksComplete([{ ...regulationPlayers[0], roundScores: [{ round: 4, complete: false }] }], 4), 'incomplete round 4 should not be final')

const tournamentSync = readFileSync(new URL('../src/lib/tournament-sync.ts', import.meta.url), 'utf8')
assert(!tournamentSync.includes('Math.min(reportedRound, 4)'), 'production sync must not hard-cap final scoring at round 4')
assert(tournamentSync.includes('latestScorecardRound'), 'production sync should fall back to the latest scorecard round when ESPN reports an empty playoff/delayed period')

console.log('Final round completion verification passed')
