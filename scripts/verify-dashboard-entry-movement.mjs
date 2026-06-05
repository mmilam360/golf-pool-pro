import assert from 'node:assert/strict'
import { entryMovementSincePriorRank, leaderboardForCompletedRound, scoreEntriesForLeaderboard } from '../src/lib/scoring.ts'

function player(name, roundOne, roundTwo) {
  return {
    id: name.toLowerCase().replaceAll(' ', '-'),
    name,
    firstName: name.split(' ')[0],
    lastName: name.split(' ').slice(1).join(' '),
    score: roundOne + roundTwo === 0 ? 'E' : String(roundOne + roundTwo),
    scoreToPar: roundOne + roundTwo,
    strokes: 0,
    thru: '9',
    roundScore: roundTwo === 0 ? 'E' : roundTwo > 0 ? `+${roundTwo}` : String(roundTwo),
    position: '',
    status: 'active',
    country: '',
    roundScores: [
      { round: 1, roundScoreToPar: roundOne, cumulativeScoreToPar: roundOne, complete: true },
      { round: 2, roundScoreToPar: roundTwo, cumulativeScoreToPar: roundOne + roundTwo, complete: false },
    ],
  }
}

const leaderboard = [
  player('Alpha One', -7, 2),
  player('Beta Two', -3, 4),
  player('Gamma Three', 5, -5),
  player('Delta Four', -5, 1),
  player('Echo Five', -4, 0),
  player('Foxtrot Six', -4, 0),
  player('Golf Seven', -4, 1),
  player('Hotel Eight', -3, 0),
  player('India Nine', -4, 1),
]

const entries = [
  { id: 'me', display_name: 'Me', golfer_picks: ['Alpha One', 'Beta Two', 'Gamma Three'], is_removed: false },
  { id: 'second', display_name: 'Second', golfer_picks: ['Delta Four', 'Echo Five'], is_removed: false },
  { id: 'third', display_name: 'Third', golfer_picks: ['Foxtrot Six', 'Golf Seven'], is_removed: false },
  { id: 'fourth', display_name: 'Fourth', golfer_picks: ['Hotel Eight', 'India Nine'], is_removed: false },
]

const options = { countScores: 2, obRuleEnabled: false, obPenaltyStrokes: 2 }
const current = scoreEntriesForLeaderboard(entries, leaderboard, options)
const prior = scoreEntriesForLeaderboard(entries, leaderboardForCompletedRound(leaderboard, 1), options)

const meNow = current.find(entry => entry.entryId === 'me')
const mePrior = prior.find(entry => entry.entryId === 'me')

assert.equal(mePrior?.rank, 1, 'entry started the day in first using Thursday best-count standings')
assert.equal(mePrior?.totalScore, -10)
assert.equal(meNow?.rank, 4, 'entry is fourth on the live board')
assert.equal(meNow?.totalScore, -5)
assert.equal(meNow?.todayScore, -3, 'today score uses the current counting picks only')
assert.deepEqual(entryMovementSincePriorRank(meNow, prior), { direction: 'down', spots: 3 })

const tiedFirstYesterday = [
  { ...mePrior, totalScore: -10, rank: 2 },
  { ...prior.find(entry => entry.entryId === 'second'), totalScore: -10, rank: 1 },
  { ...prior.find(entry => entry.entryId === 'third'), totalScore: -8, rank: 3 },
]
assert.deepEqual(
  entryMovementSincePriorRank({ ...meNow, rank: 3 }, tiedFirstYesterday),
  { direction: 'down', spots: 2 },
  'movement uses the prior total-score rank players saw yesterday, not a tiebreak-only #2 baseline'
)

const oldTiebreakPriorRank = tiedFirstYesterday.find(entry => entry.entryId === 'me')?.rank
assert.equal(oldTiebreakPriorRank, 2)

const oldSubtractTodayRank = current
  .map(entry => ({ ...entry, totalScore: entry.totalScore !== null && entry.todayScore !== null ? entry.totalScore - entry.todayScore : null, tiebreakScores: [], rank: null }))
  .sort((a, b) => (a.totalScore ?? 999) - (b.totalScore ?? 999))
  .findIndex(entry => entry.entryId === 'me') + 1
assert.notEqual(oldSubtractTodayRank, mePrior.rank, 'subtracting today from current best-count picks reproduces the glitch')

console.log('dashboard entry movement checks passed')
