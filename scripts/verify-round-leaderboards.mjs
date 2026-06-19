import assert from 'node:assert/strict'
import { applyTodayTeeInfo } from '../src/lib/golf-api.ts'
import { leaderboardBackedPickProgressLabel } from '../src/lib/golfer-status.ts'
import { availableCompletedRounds, leaderboardForCompletedRound, leaderboardForRoundOnly, leaderboardHasPlayoffScores, scoreEntriesForLeaderboard } from '../src/lib/scoring.ts'

function holes(backNineTotal, frontNineTotal = 0) {
  const front = Array.from({ length: 9 }, (_, index) => ({ hole: index + 1, score: 4, par: 4, scoreToPar: 0 }))
  const back = Array.from({ length: 9 }, (_, index) => ({ hole: index + 10, score: 4, par: 4, scoreToPar: 0 }))
  front[0].scoreToPar = frontNineTotal
  front[0].score = 4 + frontNineTotal
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

assert.deepEqual(availableCompletedRounds(players), [1, 2], 'completed rounds should be selectable')

const splitWavePlayers = [
  {
    id: 'early', name: 'Early Starter', firstName: 'Early', lastName: 'Starter', score: '-1', scoreToPar: -1, strokes: 0, thru: '4', roundScore: '-1', position: '1', status: 'active', country: '',
    roundScores: [
      { round: 1, roundScoreToPar: -2, cumulativeScoreToPar: -2, complete: true, holes: holes(-1) },
      { round: 2, roundScoreToPar: 1, cumulativeScoreToPar: -1, complete: false, holes: holes(0).slice(0, 4) },
    ],
  },
  {
    id: 'holdover', name: 'Round One Holdover', firstName: 'Round', lastName: 'Holdover', score: '+7', scoreToPar: 7, strokes: 0, thru: '10*', roundScore: '+7', position: '156', status: 'active', country: '',
    roundScores: [
      { round: 1, roundScoreToPar: 7, cumulativeScoreToPar: 7, complete: false, holes: holes(1).slice(0, 10) },
    ],
  },
]

assert.deepEqual(availableCompletedRounds(splitWavePlayers), [1], 'prior round should stay selectable once the next round has started')
assert.deepEqual(availableCompletedRounds(splitWavePlayers.map(player => ({ ...player, roundScores: player.roundScores.filter(round => round.round === 1) }))), [], 'incomplete opening round should not be selectable before the next round starts')

const thursdayOnlyBoard = leaderboardForRoundOnly(splitWavePlayers, 1)
const holdoverRound = thursdayOnlyBoard.find(player => player.name === 'Round One Holdover')
assert.equal(holdoverRound?.status, 'active', 'holdover golfer should not be marked cut on the Thursday-only board')
assert.equal(holdoverRound?.scoreToPar, 7)
assert.equal(holdoverRound?.roundScore, '+7')
assert.equal(holdoverRound?.thru, '10*')
assert.deepEqual(thursdayOnlyBoard.find(player => player.name === 'Early Starter')?.roundScores?.map(round => round.round), [1], 'daily board should use only the selected round for status labels')

const fridayBoard = leaderboardForCompletedRound(players, 2)
const fridayCut = fridayBoard.find(player => player.name === 'Friday Cut')
assert.equal(fridayCut?.status, 'active', 'cut golfer should still count in historical Friday standings because they completed Friday')
assert.equal(fridayCut?.scoreToPar, 6)
assert.equal(fridayCut?.roundScore, '+3')
assert.equal(fridayCut?.thru, 'F')
assert.deepEqual(fridayCut?.roundScores?.map(round => round.round), [1, 2], 'through-round board should trim later rounds out of status labels')

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

const firstRoundLive = scoreEntriesForLeaderboard(
  [
    { id: 'entry-live', display_name: 'Entry Live', golfer_picks: ['Future Even A', 'Over Par Playing', 'Future Even B', 'Under Par Playing'], is_removed: false },
  ],
  [
    { id: 'future-a', name: 'Future Even A', firstName: 'Future', lastName: 'A', score: 'E', scoreToPar: 0, strokes: 0, thru: '', roundScore: '', teeTime: '2026-06-18T20:00:00Z', position: 'T1', status: 'active', country: '', roundScores: [] },
    { id: 'over', name: 'Over Par Playing', firstName: 'Over', lastName: 'Playing', score: '+2', scoreToPar: 2, strokes: 0, thru: '2', roundScore: '+2', teeTime: '2026-06-18T12:00:00Z', position: 'T70', status: 'active', country: '', roundScores: [{ round: 1, roundScoreToPar: 2, cumulativeScoreToPar: 2, complete: false }] },
    { id: 'future-b', name: 'Future Even B', firstName: 'Future', lastName: 'B', score: 'E', scoreToPar: 0, strokes: 0, thru: '', roundScore: '', teeTime: '2026-06-18T21:00:00Z', position: 'T1', status: 'active', country: '', roundScores: [] },
    { id: 'under', name: 'Under Par Playing', firstName: 'Under', lastName: 'Playing', score: '-1', scoreToPar: -1, strokes: 0, thru: '1', roundScore: '-1', teeTime: '2026-06-18T12:00:00Z', position: 'T5', status: 'active', country: '', roundScores: [{ round: 1, roundScoreToPar: -1, cumulativeScoreToPar: -1, complete: false }] },
  ],
  { countScores: 3, obRuleEnabled: false, obPenaltyStrokes: 2 }
)
const firstRoundEntry = firstRoundLive[0]
assert.equal(firstRoundEntry.totalScore, 1, 'not-started first-round E golfers should not add fake even-par scores to totals')
assert.equal(firstRoundEntry.todayScore, 1, 'today score should ignore not-started blank golfers')
assert.deepEqual(firstRoundEntry.pickScores.filter(pick => pick.counted).map(pick => pick.name), ['Under Par Playing', 'Over Par Playing', 'Future Even A'], 'started golfers should stay in top picks ahead of not-started blank golfers')
assert.equal(firstRoundEntry.pickScores.find(pick => pick.name === 'Future Even A')?.scoreToPar, null, 'not-started E golfer should score as blank until on course')

const delayedRoundPlayer = {
  id: 'delayed-r1', name: 'Delayed Round One', firstName: 'Delayed', lastName: 'One', score: '+2', scoreToPar: 2, strokes: 0, thru: '15', roundScore: '+2', position: 'T70', status: 'active', country: '',
  roundScores: [{ round: 1, roundScoreToPar: 2, cumulativeScoreToPar: 2, complete: false, holes: holes(2).slice(0, 15) }],
}
const delayedWithFutureFridayTee = applyTodayTeeInfo(delayedRoundPlayer, { teeTime: '2026-06-19T16:00:00Z', startTee: 1, roundScore: '', started: false })
assert.equal(delayedWithFutureFridayTee.thru, '15', 'future Friday tee time should not blank a suspended Thursday round still in progress')
assert.equal(delayedWithFutureFridayTee.roundScore, '+2', 'suspended Thursday round score should remain the active round score')
assert.equal(delayedWithFutureFridayTee.teeTime, undefined, 'future next-round tee time should not override active delayed-round progress')

const delayedRoundScore = scoreEntriesForLeaderboard(
  [{ id: 'entry-delayed', display_name: 'Entry Delayed', golfer_picks: ['Delayed Round One'], is_removed: false }],
  [delayedWithFutureFridayTee],
  { countScores: 1, obRuleEnabled: false, obPenaltyStrokes: 2 }
)[0]
assert.equal(delayedRoundScore.totalScore, 2, 'suspended Thursday holes played Friday should keep counting in the current total')
assert.equal(delayedRoundScore.todayScore, 2, 'suspended Thursday holes played Friday should keep using the Thursday round score')
assert.equal(leaderboardBackedPickProgressLabel(delayedRoundScore.pickScores[0], delayedWithFutureFridayTee, 'America/New_York', new Date('2026-06-19T13:00:00Z')), '+2 THRU 15', 'suspended Thursday round should show live thru status, not a future Friday tee time')

const priorRoundEven = scoreEntriesForLeaderboard(
  [
    { id: 'entry-prior-even', display_name: 'Entry Prior Even', golfer_picks: ['Prior Even'], is_removed: false },
  ],
  [
    { id: 'prior-even', name: 'Prior Even', firstName: 'Prior', lastName: 'Even', score: 'E', scoreToPar: 0, strokes: 0, thru: '', roundScore: '', teeTime: '2026-06-19T20:00:00Z', position: 'T20', status: 'active', country: '', roundScores: [{ round: 1, roundScoreToPar: 0, cumulativeScoreToPar: 0, complete: true }] },
  ],
  { countScores: 1, obRuleEnabled: false, obPenaltyStrokes: 2 }
)
assert.equal(priorRoundEven[0].totalScore, 0, 'even-par scores from completed prior rounds should still count as E')

const finalRoundPlayers = [
  {
    id: 'final-a', name: 'Final A', firstName: 'Final', lastName: 'A', score: '-8', scoreToPar: -8, strokes: 0, thru: 'F', roundScore: '-2', position: '1', status: 'active', country: '',
    roundScores: [
      { round: 1, roundScoreToPar: -2, cumulativeScoreToPar: -2, complete: true, holes: holes(-2) },
      { round: 2, roundScoreToPar: -1, cumulativeScoreToPar: -3, complete: true, holes: holes(-1) },
      { round: 3, roundScoreToPar: -3, cumulativeScoreToPar: -6, complete: true, holes: holes(-3) },
      { round: 4, roundScoreToPar: -2, cumulativeScoreToPar: -8, complete: true, holes: holes(-2) },
    ],
  },
]
assert.equal(leaderboardHasPlayoffScores(finalRoundPlayers), false, 'normal completed round 4 should be treated as final, not a playoff')
assert.equal(leaderboardHasPlayoffScores([
  {
    ...finalRoundPlayers[0],
    roundScores: [
      ...finalRoundPlayers[0].roundScores,
      { round: 5, roundScoreToPar: 0, cumulativeScoreToPar: -8, complete: true, holes: holes(0).slice(0, 1) },
    ],
  },
]), true, 'scored round after round 4 should be treated as playoff data')

const extendedTieBreak = scoreEntriesForLeaderboard(
  [
    { id: 'entry-nine-a', display_name: 'Entry Nine A', golfer_picks: ['Nine Tie A'], is_removed: false },
    { id: 'entry-nine-b', display_name: 'Entry Nine B', golfer_picks: ['Nine Tie B'], is_removed: false },
  ],
  [
    {
      id: 'nine-a', name: 'Nine Tie A', firstName: 'Nine', lastName: 'A', score: 'E', scoreToPar: 0, strokes: 0, thru: 'F', roundScore: 'E', position: '1', status: 'active', country: '',
      roundScores: [
        { round: 1, roundScoreToPar: 0, cumulativeScoreToPar: 0, complete: true, holes: holes(0, 2) },
      ],
    },
    {
      id: 'nine-b', name: 'Nine Tie B', firstName: 'Nine', lastName: 'B', score: 'E', scoreToPar: 0, strokes: 0, thru: 'F', roundScore: 'E', position: '1', status: 'active', country: '',
      roundScores: [
        { round: 1, roundScoreToPar: 0, cumulativeScoreToPar: 0, complete: true, holes: holes(0, -1) },
      ],
    },
  ],
  { countScores: 1, obRuleEnabled: false, obPenaltyStrokes: 2 }
)

assert.equal(extendedTieBreak[0].entryId, 'entry-nine-b', 'when final nine is tied, tiebreak should continue back to final 18 holes')
assert.equal(extendedTieBreak[0].rank, 1)
assert.equal(extendedTieBreak[1].rank, 2)

console.log('round leaderboard checks passed')
