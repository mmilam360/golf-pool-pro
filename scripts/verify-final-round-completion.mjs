import { finalRoundLooksComplete } from '../src/lib/tournament-sync.ts'

function assert(condition, message) {
  if (!condition) throw new Error(message)
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

console.log('Final round completion verification passed')
