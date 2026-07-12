import {
  completedScoringRound,
  finalBoardHasEnoughEvidence,
  finalBoardLooksComplete,
  hasPostCutRoundEvidence,
  hasUsablePlayerIdentities,
  hasWeekendCutStatusErrors,
  latestScorecardRound,
  preferredStoredLeaderboard,
  repairWeekendCutStatuses,
  weekendCutStatusErrorNames,
} from '../src/lib/leaderboard-sanity.ts'
import { hydrateFinalLeaderboard } from '../src/lib/fresh-final-leaderboard.ts'
import { scoreEntry, scoreEntriesForLeaderboard } from '../src/lib/scoring.ts'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const round = (round, complete = true, holes = 18) => ({
  round,
  complete,
  holes: Array.from({ length: holes }, (_, index) => ({ hole: index + 1, score: 4, par: 4, scoreToPar: 0 })),
})

const weekendPlayerMarkedCut = {
  id: 'weekend-cut-error',
  name: 'Weekend Cut Error',
  firstName: 'Weekend',
  lastName: 'Error',
  status: 'cut',
  score: '+7',
  scoreToPar: 7,
  strokes: 295,
  thru: 'F',
  roundScore: '+1',
  position: 'CUT',
  country: 'USA',
  roundScores: [round(1), round(2), round(3), round(4)],
}

const trueMissedCut = {
  ...weekendPlayerMarkedCut,
  id: 'true-cut',
  name: 'True Missed Cut',
  thru: '',
  roundScore: '',
  roundScores: [round(1), round(2)],
}

const activeFinalPlayer = {
  ...weekendPlayerMarkedCut,
  id: 'active-final',
  name: 'Active Final',
  status: 'active',
  score: '-4',
  scoreToPar: -4,
  position: '15',
  roundScores: [round(1), round(2), round(3), round(4)],
}

const wdAfterWeekend = {
  ...weekendPlayerMarkedCut,
  id: 'wd-weekend',
  name: 'Weekend WD',
  status: 'wd',
  score: 'WD',
  scoreToPar: 3,
  position: 'WD',
  roundScores: [round(1), round(2), round(3, false, 5)],
}

const delayedSundayBoard = [
  { ...activeFinalPlayer, name: 'Finished One', thru: 'F', roundScores: [round(1), round(2), round(3), round(4)] },
  { ...activeFinalPlayer, name: 'Finished Two', thru: '', roundScores: [round(1), round(2), round(3), round(4)] },
  trueMissedCut,
]

const playoffBoard = [
  { ...activeFinalPlayer, name: 'Playoff One', thru: '', roundScores: [round(1), round(2), round(3), round(4), round(5)] },
  { ...activeFinalPlayer, name: 'Playoff Two', thru: '', roundScores: [round(1), round(2), round(3), round(4), round(5)] },
]

const incompleteMondayBoard = [
  { ...activeFinalPlayer, name: 'Still Playing', thru: '12', roundScores: [round(1), round(2), round(3), round(4, false, 12)] },
  trueMissedCut,
]

assert(hasPostCutRoundEvidence(weekendPlayerMarkedCut), 'detects weekend evidence from roundScores/thru/roundScore')
assert(!hasPostCutRoundEvidence(trueMissedCut), 'does not treat normal two-round missed cut as weekend evidence')
assert(hasWeekendCutStatusErrors([weekendPlayerMarkedCut]), 'flags weekend player marked cut')
assert(!hasWeekendCutStatusErrors([trueMissedCut]), 'allows true missed-cut players')
assert(!hasWeekendCutStatusErrors([wdAfterWeekend]), 'does not collapse WD/DQ-style statuses into cut errors')
assert(weekendCutStatusErrorNames([weekendPlayerMarkedCut, trueMissedCut]).join(',') === 'Weekend Cut Error', 'returns only bad weekend-cut names')
assert(latestScorecardRound(playoffBoard) === 5, 'finds actual playoff scorecard round')
assert(completedScoringRound(delayedSundayBoard, 5) === 4, 'falls back to round 4 when ESPN reports empty round 5')
assert(completedScoringRound(playoffBoard, 5) === 5, 'uses round 5 when actual playoff scorecards exist')
assert(finalBoardLooksComplete(delayedSundayBoard, 5), 'delayed/playoff-period final board can complete from round 4 evidence')
assert(finalBoardLooksComplete(playoffBoard, 5), 'playoff board is complete when playoff scorecards complete')
assert(!finalBoardLooksComplete(incompleteMondayBoard, 4), 'suspended/incomplete final round is not final')
assert(!finalBoardHasEnoughEvidence([weekendPlayerMarkedCut, activeFinalPlayer], 4), 'bad weekend CUT final board fails evidence gate')
assert(finalBoardHasEnoughEvidence(delayedSundayBoard, 5), 'clean final board passes evidence gate')

const degradedHistoricalBoard = delayedSundayBoard.map((player, index) => ({
  id: player.id,
  name: 'Unknown',
  firstName: 'Unknown',
  lastName: '',
  status: 'active',
  score: '[object Object]',
  scoreToPar: 0,
  thru: '',
  roundScore: '',
  roundScores: [],
  position: String(index + 1),
}))
const anonymousCompleteBoard = delayedSundayBoard.map(player => ({ ...player, name: 'Unknown' }))
assert(!hasUsablePlayerIdentities(anonymousCompleteBoard), 'rejects a majority-anonymous leaderboard')
assert(
  !finalBoardHasEnoughEvidence(anonymousCompleteBoard, 5),
  'complete score evidence does not make an anonymous final board usable',
)
assert(
  preferredStoredLeaderboard('completed', anonymousCompleteBoard, delayedSundayBoard) === delayedSundayBoard,
  'completed pool prefers the named final field when anonymous rows contain complete scorecards',
)
assert(
  preferredStoredLeaderboard('completed', degradedHistoricalBoard, delayedSundayBoard) === delayedSundayBoard,
  'completed pool uses the valid final field snapshot when stored leaderboard rows are anonymous and scoreless',
)
assert(
  preferredStoredLeaderboard('completed', delayedSundayBoard, degradedHistoricalBoard) === delayedSundayBoard,
  'completed pool keeps the primary final leaderboard when it has enough evidence',
)
assert(
  preferredStoredLeaderboard('live', degradedHistoricalBoard, delayedSundayBoard) === degradedHistoricalBoard,
  'live pool never replaces its current leaderboard with a stored field snapshot',
)

let hydrationCalls = 0
const shouldNotHydrate = async () => {
  hydrationCalls += 1
  throw new Error('stored final board should avoid ESPN hydration')
}
const completedWithValidLeaderboard = {
  external_id: 'stored-final',
  status: 'completed',
  leaderboard_json: delayedSundayBoard,
  field_json: degradedHistoricalBoard,
}
const keptStoredFinal = await hydrateFinalLeaderboard(completedWithValidLeaderboard, shouldNotHydrate)
assert(hydrationCalls === 0, 'valid stored final board does not fetch ESPN')
assert(keptStoredFinal.leaderboard_json === delayedSundayBoard, 'valid stored final board remains primary')

const completedWithValidField = {
  external_id: 'stored-field',
  status: 'completed',
  leaderboard_json: degradedHistoricalBoard,
  field_json: delayedSundayBoard,
}
const usedStoredField = await hydrateFinalLeaderboard(completedWithValidField, shouldNotHydrate)
assert(hydrationCalls === 0, 'valid stored final field does not fetch ESPN')
assert(usedStoredField.leaderboard_json === delayedSundayBoard, 'valid stored final field replaces degraded primary rows')

let degradedHydrationCalls = 0
const rejectedFreshBoard = await hydrateFinalLeaderboard({
  external_id: 'degraded-fresh',
  status: 'completed',
  leaderboard_json: degradedHistoricalBoard,
  field_json: degradedHistoricalBoard,
}, async () => {
  degradedHydrationCalls += 1
  return { leaderboard: anonymousCompleteBoard }
})
assert(degradedHydrationCalls === 1, 'missing stored final evidence allows one fresh lookup')
assert(rejectedFreshBoard.leaderboard_json === degradedHistoricalBoard, 'anonymous fresh final board is rejected')

const acceptedFreshBoard = await hydrateFinalLeaderboard({
  external_id: 'valid-fresh',
  status: 'completed',
  leaderboard_json: degradedHistoricalBoard,
  field_json: degradedHistoricalBoard,
}, async () => ({ leaderboard: delayedSundayBoard }))
assert(
  acceptedFreshBoard.leaderboard_json?.[0]?.name === delayedSundayBoard[0].name
    && finalBoardHasEnoughEvidence(acceptedFreshBoard.leaderboard_json, 5),
  'valid fresh final board is accepted',
)

const repairedBoard = repairWeekendCutStatuses([weekendPlayerMarkedCut, trueMissedCut, activeFinalPlayer])
assert(repairedBoard[0].status === 'active', 'repairs a made-cut weekend player from CUT to active')
assert(repairedBoard[1].status === 'cut', 'does not repair a true two-round missed cut')
assert(!hasWeekendCutStatusErrors(repairedBoard), 'repaired board has no weekend-cut errors')

const corruptedScoringBoard = [
  { ...weekendPlayerMarkedCut, name: 'Made Cut Bad Status', scoreToPar: -8, score: '-8' },
  { ...activeFinalPlayer, name: 'Worst Active', scoreToPar: 20, score: '+20' },
  { ...trueMissedCut, name: 'True Cut Pick', scoreToPar: 9, score: '+9' },
]
const scored = scoreEntry(['Made Cut Bad Status', 'True Cut Pick'], corruptedScoringBoard, {
  countScores: 2,
  obRuleEnabled: true,
  obPenaltyStrokes: 2,
})
assert(scored.obStandIns === 1, 'scoring repairs made-cut bad status before assigning OB stand-ins')
assert(scored.totalScore === 14, `scoring counts repaired made-cut player plus one true OB stand-in, got ${scored.totalScore}`)
const ranked = scoreEntriesForLeaderboard([
  { id: 'entry-1', display_name: 'Entry 1', golfer_picks: ['Made Cut Bad Status', 'True Cut Pick'] },
], corruptedScoringBoard, { countScores: 2, obRuleEnabled: true, obPenaltyStrokes: 2 })
assert(ranked[0].obStandIns === 1, 'scoreEntriesForLeaderboard uses the same repair invariant')

console.log('Leaderboard sanity verification passed')
