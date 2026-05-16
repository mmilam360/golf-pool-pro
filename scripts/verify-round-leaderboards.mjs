import assert from 'node:assert/strict'
import { availableCompletedRounds, leaderboardForCompletedRound, leaderboardForRoundOnly, scoreEntriesForLeaderboard } from '../src/lib/scoring.ts'

const players = [
  {
    id: 'a', name: 'Steady A', firstName: 'Steady', lastName: 'A', score: '-1', scoreToPar: -1, strokes: 0, thru: 'F', roundScore: '-1', position: '1', status: 'active', country: '',
    roundScores: [
      { round: 1, roundScoreToPar: -2, cumulativeScoreToPar: -2, complete: true },
      { round: 2, roundScoreToPar: 1, cumulativeScoreToPar: -1, complete: true },
      { round: 3, roundScoreToPar: 0, cumulativeScoreToPar: -1, complete: false },
    ],
  },
  {
    id: 'b', name: 'Friday Cut', firstName: 'Friday', lastName: 'Cut', score: '+6', scoreToPar: 6, strokes: 0, thru: '', roundScore: '', position: 'CUT', status: 'cut', country: '',
    roundScores: [
      { round: 1, roundScoreToPar: 3, cumulativeScoreToPar: 3, complete: true },
      { round: 2, roundScoreToPar: 3, cumulativeScoreToPar: 6, complete: true },
    ],
  },
  {
    id: 'c', name: 'Incomplete C', firstName: 'Incomplete', lastName: 'C', score: '+2', scoreToPar: 2, strokes: 0, thru: '7', roundScore: '+3', position: '20', status: 'active', country: '',
    roundScores: [
      { round: 1, roundScoreToPar: -1, cumulativeScoreToPar: -1, complete: true },
      { round: 2, roundScoreToPar: 0, cumulativeScoreToPar: -1, complete: true },
      { round: 3, roundScoreToPar: 3, cumulativeScoreToPar: 2, complete: false },
    ],
  },
]

assert.deepEqual(availableCompletedRounds(players), [1, 2], 'only fully completed rounds should be selectable')

const fridayBoard = leaderboardForCompletedRound(players, 2)
const fridayCut = fridayBoard.find(player => player.name === 'Friday Cut')
assert.equal(fridayCut?.status, 'active', 'cut golfer should still count in historical Friday standings because they completed Friday')
assert.equal(fridayCut?.scoreToPar, 6)
assert.equal(fridayCut?.roundScore, '+3')
assert.equal(fridayCut?.thru, 'F')

const scored = scoreEntriesForLeaderboard(
  [
    { id: 'entry-1', display_name: 'Entry One', golfer_picks: ['Steady A', 'Friday Cut'], is_removed: false },
    { id: 'entry-2', display_name: 'Entry Two', golfer_picks: ['Incomplete C', 'Steady A'], is_removed: false },
  ],
  fridayBoard,
  { countScores: 2, obRuleEnabled: true, obPenaltyStrokes: 2 }
)

assert.equal(scored[0].entryId, 'entry-2', 'Friday standings should rank by cumulative through selected round')
assert.equal(scored[0].totalScore, -2)
assert.equal(scored[1].totalScore, 5)

const fridayOnlyBoard = leaderboardForRoundOnly(players, 2)
const fridayOnly = scoreEntriesForLeaderboard(
  [
    { id: 'entry-1', display_name: 'Entry One', golfer_picks: ['Steady A', 'Friday Cut'], is_removed: false },
    { id: 'entry-2', display_name: 'Entry Two', golfer_picks: ['Incomplete C', 'Steady A'], is_removed: false },
  ],
  fridayOnlyBoard,
  { countScores: 2, obRuleEnabled: true, obPenaltyStrokes: 2 }
)

assert.equal(fridayOnly[0].entryId, 'entry-2', 'daily board should rank by selected round only')
assert.equal(fridayOnly[0].totalScore, 1)
assert.equal(fridayOnly[1].totalScore, 4)
assert.equal(fridayOnlyBoard.find(player => player.name === 'Steady A')?.scoreToPar, 1)
assert.equal(fridayOnlyBoard.find(player => player.name === 'Friday Cut')?.scoreToPar, 3)

console.log('round leaderboard checks passed')
