import assert from 'node:assert/strict'
import { availableCompletedRounds, leaderboardForCompletedRound, leaderboardForRoundOnly, scoreEntriesForLeaderboard } from '../src/lib/scoring.ts'

function holes(backNineTotal) {
  const front = Array.from({ length: 9 }, (_, index) => ({ hole: index + 1, score: 4, par: 4, scoreToPar: 0 }))
  const back = Array.from({ length: 9 }, (_, index) => ({ hole: index + 10, score: 4, par: 4, scoreToPar: 0 }))
  back[0].scoreToPar = backNineTotal
  back[0].score = 4 + backNineTotal
  return [...front, ...back]
}

const players = [
  {
    id: 'a', name: 'Steady A', firstName: 'Steady', lastName: 'A', score: '-1', scoreToPar: -1, strokes: 0, thru: 'F', roundScore: '-1', position: '1', status: 'active', country: '',
    roundScores: [
      { round: 1, roundScoreToPar: -2, cumulativeScoreToPar: -2, complete: true },
      { round: 2, roundScoreToPar: 1, cumulativeScoreToPar: -1, complete: true, holes: holes(2) },
      { round: 3, roundScoreToPar: 0, cumulativeScoreToPar: -1, complete: false },
    ],
  },
  {
    id: 'b', name: 'Friday Cut', firstName: 'Friday', lastName: 'Cut', score: '+6', scoreToPar: 6, strokes: 0, thru: '', roundScore: '', position: 'CUT', status: 'cut', country: '',
    roundScores: [
      { round: 1, roundScoreToPar: 3, cumulativeScoreToPar: 3, complete: true },
      { round: 2, roundScoreToPar: 3, cumulativeScoreToPar: 6, complete: true, holes: holes(0) },
    ],
  },
  {
    id: 'c', name: 'Incomplete C', firstName: 'Incomplete', lastName: 'C', score: '+2', scoreToPar: 2, strokes: 0, thru: '7', roundScore: '+3', position: '20', status: 'active', country: '',
    roundScores: [
      { round: 1, roundScoreToPar: -1, cumulativeScoreToPar: -1, complete: true },
      { round: 2, roundScoreToPar: 0, cumulativeScoreToPar: -1, complete: true, holes: holes(-1) },
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
assert.equal(scored[0].todayScore, 1, 'through-round board should still expose selected day team score')
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
assert.equal(fridayOnly[0].todayScore, 1)
assert.equal(fridayOnly[1].totalScore, 4)
assert.equal(fridayOnlyBoard.find(player => player.name === 'Steady A')?.scoreToPar, 1)
assert.equal(fridayOnlyBoard.find(player => player.name === 'Friday Cut')?.scoreToPar, 3)

const currentWithOb = scoreEntriesForLeaderboard(
  [
    { id: 'entry-ob', display_name: 'Entry OB', golfer_picks: ['Steady A', 'Friday Cut'], is_removed: false },
  ],
  players,
  { countScores: 2, obRuleEnabled: true, obPenaltyStrokes: 2 }
)

assert.equal(currentWithOb[0].obStandIns, 1)
assert.equal(currentWithOb[0].totalScore, 3, 'OB stand-in total should use worst active total plus penalty')
assert.equal(currentWithOb[0].todayScore, 4, 'OB stand-in today score should use worst active today plus penalty')

const tieBreak = scoreEntriesForLeaderboard(
  [
    { id: 'entry-a', display_name: 'Entry A', golfer_picks: ['Steady A', 'Friday Cut'], is_removed: false },
    { id: 'entry-b', display_name: 'Entry B', golfer_picks: ['Incomplete C', 'Friday Cut'], is_removed: false },
  ],
  [
    { ...players[0], scoreToPar: -1, roundScores: players[0].roundScores.filter(round => round.complete) },
    { ...players[1], scoreToPar: 1, status: 'active', position: '20' },
    { ...players[2], scoreToPar: -1, roundScores: players[2].roundScores.filter(round => round.complete) },
  ],
  { countScores: 2, obRuleEnabled: false, obPenaltyStrokes: 2 }
)

assert.equal(tieBreak[0].entryId, 'entry-b', 'final-nine tiebreak should sort tied totals by aggregate counting-player back-nine score')
assert.equal(tieBreak[0].totalScore, 0)
assert.equal(tieBreak[0].finalNineScore, -1)
assert.equal(tieBreak[0].rank, 1)
assert.equal(tieBreak[1].rank, 2)

console.log('round leaderboard checks passed')
