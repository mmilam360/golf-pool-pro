import { readFileSync } from 'node:fs'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function finalRoundLooksComplete(players, round) {
  const reportedRound = Number(round || 0)
  if (reportedRound < 4) return false
  const scoringRound = Math.min(reportedRound, 4)
  const activePlayers = players.filter(player => player?.status === 'active')
  if (activePlayers.length === 0) return false
  return activePlayers.every(player => {
    if (String(player?.thru || '').toUpperCase() === 'F') return true
    const finalRound = Array.isArray(player?.roundScores)
      ? player.roundScores.find(score => Number(score?.round) === scoringRound)
      : null
    return Boolean(finalRound?.complete)
  })
}

const players = [
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

assert(finalRoundLooksComplete(players, 4), 'round 4 should be complete when active players have complete round 4 scores')
assert(finalRoundLooksComplete(players, 5), 'ESPN round 5 playoff/delayed status should still use round 4 as final scoring round')
assert(!finalRoundLooksComplete([{ ...players[0], roundScores: [{ round: 4, complete: false }] }], 4), 'incomplete round 4 should not be final')

const tournamentSync = readFileSync(new URL('../src/lib/tournament-sync.ts', import.meta.url), 'utf8')
assert(tournamentSync.includes('const scoringRound = Math.min(reportedRound, 4)'), 'production sync should cap ESPN reported round at round 4 for final-board completion')

console.log('Final round completion verification passed')
