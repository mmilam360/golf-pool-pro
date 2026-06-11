import assert from 'node:assert/strict'
import { finalBoardHasEnoughEvidence } from '../src/lib/leaderboard-sanity.ts'
import { scoreEntriesForLeaderboard } from '../src/lib/scoring.ts'

const finalBoard = [
  {
    id: '1',
    name: 'Ryan Gerard',
    firstName: 'Ryan',
    lastName: 'Gerard',
    score: '-12',
    scoreToPar: -12,
    thru: 'F',
    roundScore: '-4',
    roundScores: [
      { round: 1, roundScoreToPar: -3, cumulativeScoreToPar: -3, complete: true, holes: Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, score: 4, par: 4, scoreToPar: 0 })) },
      { round: 2, roundScoreToPar: -1, cumulativeScoreToPar: -4, complete: true, holes: Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, score: 4, par: 4, scoreToPar: 0 })) },
      { round: 3, roundScoreToPar: -4, cumulativeScoreToPar: -8, complete: true, holes: Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, score: 4, par: 4, scoreToPar: 0 })) },
      { round: 4, roundScoreToPar: -4, cumulativeScoreToPar: -12, complete: true, holes: Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, score: 4, par: 4, scoreToPar: 0 })) },
    ],
    position: 'T3',
    strokes: 0,
    status: 'active',
    country: 'USA',
  },
  {
    id: '2',
    name: 'Tony Finau',
    firstName: 'Tony',
    lastName: 'Finau',
    score: '-10',
    scoreToPar: -10,
    thru: 'F',
    roundScore: '-2',
    roundScores: [{ round: 4, roundScoreToPar: -2, cumulativeScoreToPar: -10, complete: true, holes: Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, score: 4, par: 4, scoreToPar: 0 })) }],
    position: 'T8',
    strokes: 0,
    status: 'active',
    country: 'USA',
  },
]

assert.equal(finalBoardHasEnoughEvidence(finalBoard, 4), true, 'complete final board should be eligible to freeze')
assert.equal(finalBoardHasEnoughEvidence([{ ...finalBoard[0], thru: '1*', roundScores: finalBoard[0].roundScores.slice(0, 3) }], 4), false, 'partial stale board must not freeze')

const [entry] = scoreEntriesForLeaderboard(
  [{ id: 'entry-1', display_name: 'Triv', golfer_picks: ['Ryan Gerard', 'Tony Finau'], is_removed: false }],
  finalBoard,
  { countScores: 2, obRuleEnabled: false, obPenaltyStrokes: 0 },
)

assert.equal(entry.totalScore, -22)
assert.equal(entry.rank, 1)
const gerard = entry.pickScores.find(pick => pick.name === 'Ryan Gerard')
assert.equal(gerard?.scoreToPar, -12)
assert.equal(gerard?.roundScore, '-4')
assert.equal(gerard?.thru, 'F')

console.log('Final result freeze verification passed')
