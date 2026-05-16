import assert from 'node:assert/strict'
import { applyOfficialCutStatus } from '../src/lib/golf-api.ts'
import { scoreEntry } from '../src/lib/scoring.ts'
import { leaderboardBackedPickProgressLabel, leaderboardBackedPickStatusLabel, pickProgressLabel, pickStatusLabel, teeTimeLabel, tournamentThruLabel } from '../src/lib/golfer-status.ts'

const timeZone = 'America/New_York'
const now = new Date('2026-05-16T22:00:00Z') // 6:00 PM ET

assert.equal(
  pickStatusLabel({ teeTime: '2026-05-16T14:00:00Z', roundScore: '-2', scoreToPar: -2, thru: '', status: 'active', isObStandIn: false }, timeZone, now),
  'F',
  'finished same-day golfer with cleared thru should show F until midnight reset'
)

assert.equal(
  tournamentThruLabel({ teeTime: '2026-05-16T14:00:00Z', roundScore: '-2', scoreToPar: -2, thru: '', status: 'active' }, timeZone, now),
  'F',
  'tournament thru cell should show F for finished same-day golfer with cleared thru'
)

assert.equal(
  pickStatusLabel({ teeTime: '2026-05-16T23:40:00Z', thru: '', status: 'active', isObStandIn: false }, timeZone, now),
  '7:40 PM',
  'future same-day tee time should show tee time before start'
)

assert.equal(
  pickStatusLabel({ teeTime: '2026-05-16T23:40:00Z', thru: 'F', scoreToPar: -4, status: 'active', isObStandIn: false }, timeZone, now),
  '7:40 PM',
  'future tee time should beat ESPN stale F marker before start'
)

assert.equal(
  pickStatusLabel({ teeTime: '2026-05-16T23:40:00Z', startTee: 10, thru: '', status: 'active', isObStandIn: false }, timeZone, now),
  '7:40 PM*',
  'back-nine start should keep asterisk'
)

assert.equal(
  pickStatusLabel({ teeTime: '2026-05-16T14:00:00Z', roundScore: '-2', scoreToPar: -2, thru: '', status: 'active', isObStandIn: false }, timeZone, new Date('2026-05-17T04:01:00Z')),
  '—',
  'after local midnight reset, old same-day F fallback should clear'
)

assert.equal(
  tournamentThruLabel({ teeTime: '2026-05-16T23:40:00Z', thru: 'F', scoreToPar: -4, status: 'active' }, timeZone, now),
  '—',
  'full tournament thru cell should not show stale F before future tee time'
)

assert.equal(
  teeTimeLabel({ teeTime: '2026-05-16T14:00:00Z', thru: 'F', roundScore: '', status: 'active' }, timeZone),
  '10:00 AM',
  'tee time should keep showing after scheduled time if ESPN has no score for the current round yet'
)

assert.equal(
  pickStatusLabel({ teeTime: '2026-05-16T14:00:00Z', thru: '3', roundScore: '', status: 'active', isObStandIn: false }, timeZone, now),
  'THRU 3',
  'hole number should replace tee time once golfer starts current round'
)

assert.equal(
  pickStatusLabel({ teeTime: '2026-05-16T14:00:00Z', thru: 'F', roundScore: '-2', status: 'active', isObStandIn: false }, timeZone, now),
  'F',
  'finished current-round golfer should show F instead of tee time'
)

assert.equal(
  pickStatusLabel({ isObStandIn: true, thru: 'F', status: 'active' }, timeZone, now),
  'OB',
  'OB stand-in still wins'
)

assert.equal(
  leaderboardBackedPickStatusLabel(
    { name: 'Chris Gotterup', teeTime: undefined, thru: 'F', roundScore: '', status: 'active', isObStandIn: false },
    { name: 'Chris Gotterup', teeTime: '2026-05-16T18:30:00Z', thru: 'F', roundScore: '', status: 'active' },
    timeZone,
    now
  ),
  '2:30 PM',
  'active pool pick should use the full leaderboard row tee time before falling back to stale pick F'
)

assert.equal(
  leaderboardBackedPickStatusLabel(
    { name: 'Chris Gotterup', teeTime: undefined, thru: 'F', roundScore: '', status: 'active', isObStandIn: true },
    { name: 'Chris Gotterup', teeTime: '2026-05-16T18:30:00Z', thru: 'F', roundScore: '', status: 'active' },
    timeZone,
    now
  ),
  'OB',
  'OB stand-in still wins even when a leaderboard row has a tee time'
)

assert.equal(
  pickProgressLabel({ teeTime: '2026-05-16T14:00:00Z', thru: '3', roundScore: '-1', status: 'active', isObStandIn: false }, timeZone, now),
  '-1 THRU 3',
  'pool pick progress should show current-round score before holes played'
)

assert.equal(
  pickProgressLabel({ teeTime: '2026-05-16T14:00:00Z', thru: '2', roundScore: '+6', status: 'active', isObStandIn: false }, timeZone, now),
  '+6 THRU 2',
  'over-par current round score should show before holes played'
)

assert.equal(
  pickProgressLabel({ teeTime: '2026-05-16T14:00:00Z', thru: 'F', roundScore: 'E', status: 'active', isObStandIn: false }, timeZone, now),
  'E F',
  'even-par finished current round should keep round score before F'
)

assert.equal(
  leaderboardBackedPickProgressLabel(
    { name: 'Chris Gotterup', teeTime: undefined, thru: 'F', roundScore: '', status: 'active', isObStandIn: false },
    { name: 'Chris Gotterup', teeTime: '2026-05-16T18:30:00Z', thru: 'F', roundScore: '', status: 'active' },
    timeZone,
    now
  ),
  '2:30 PM',
  'pool pick progress should still show tee time, not score prefix, before start'
)

assert.equal(
  pickStatusLabel({ teeTime: '2026-05-16T23:40:00Z', thru: '', roundScore: '', status: 'cut', isObStandIn: false }, timeZone, now),
  'CUT',
  'cut golfer pick should show CUT instead of tee time or thru'
)

assert.equal(
  leaderboardBackedPickProgressLabel(
    { name: 'Cut Golfer', thru: 'F', roundScore: '', status: 'active', isObStandIn: false },
    { name: 'Cut Golfer', teeTime: '2026-05-16T18:30:00Z', thru: 'F', roundScore: '', status: 'cut' },
    timeZone,
    now
  ),
  'CUT',
  'pool pick progress should use canonical leaderboard CUT status'
)

assert.equal(
  tournamentThruLabel({ teeTime: '2026-05-16T23:40:00Z', thru: '', status: 'cut' }, timeZone, now),
  'CUT',
  'full tournament thru cell should show CUT for cut golfers'
)

const cutApplied = applyOfficialCutStatus(
  [
    { id: 'made', name: 'Made Cut', firstName: 'Made', lastName: 'Cut', score: '+7', scoreToPar: 7, thru: '8', roundScore: '+5', teeTime: '2026-05-16T14:00:00Z', position: '100', strokes: 0, status: 'active', country: '' },
    { id: 'missed', name: 'Missed Cut', firstName: 'Missed', lastName: 'Cut', score: '+5', scoreToPar: 5, thru: 'F', roundScore: '+3', position: '80', strokes: 0, status: 'active', country: '' },
  ],
  { score: '+4', scoreToPar: 4, projected: false }
)
assert.equal(cutApplied[0].status, 'active', 'player above cut line who has a Saturday tee/current-round row should stay active')
assert.equal(cutApplied[1].status, 'cut', 'official cut should mark over-line players with no Saturday tee/current-round row as CUT')
assert.equal(cutApplied[1].roundScore, '', 'cut player should not keep stale Friday round score as today score')

const obEntry = scoreEntry(
  ['Safe A', 'Safe B', 'Cut Pick'],
  [
    { id: 'a', name: 'Safe A', firstName: 'Safe', lastName: 'A', score: '-2', scoreToPar: -2, strokes: 0, thru: 'F', position: '1', status: 'active', country: '' },
    { id: 'b', name: 'Safe B', firstName: 'Safe', lastName: 'B', score: '+1', scoreToPar: 1, strokes: 0, thru: 'F', position: '2', status: 'active', country: '' },
    { id: 'worst', name: 'Worst Active', firstName: 'Worst', lastName: 'Active', score: '+16', scoreToPar: 16, strokes: 0, thru: 'F', position: '80', status: 'active', country: '' },
    { id: 'cut', name: 'Cut Pick', firstName: 'Cut', lastName: 'Pick', score: '+5', scoreToPar: 5, strokes: 0, thru: '', position: 'CUT', status: 'cut', country: '' },
  ],
  { countScores: 3, obRuleEnabled: true, obPenaltyStrokes: 2 }
)
const obPick = obEntry.pickScores.find(pick => pick.isObStandIn)
assert.equal(obPick?.name, 'Cut Pick', 'OB replacement should keep the original golfer name')
assert.equal(obPick?.scoreToPar, 18, 'OB replacement should use worst active score plus penalty')
assert.equal(
  leaderboardBackedPickProgressLabel(obPick, { name: 'Cut Pick', status: 'cut', scoreToPar: 5, thru: '', roundScore: '' }, timeZone, now),
  'CUT',
  'OB replacement status text should show CUT, while main score carries the adjusted OB score'
)

assert.equal(
  pickProgressLabel({ teeTime: '2026-05-16T14:00:00Z', thru: 'F', roundScore: '+2', status: 'cut', isObStandIn: false }, timeZone, now),
  'CUT',
  'cut golfers should not show stale today score in outside-top/player chips'
)

assert.equal(
  leaderboardBackedPickProgressLabel(
    { name: 'Cut Golfer', thru: 'F', roundScore: '+2', status: 'cut', isObStandIn: false },
    { name: 'Cut Golfer', teeTime: undefined, thru: '', roundScore: '', status: 'cut' },
    timeZone,
    now
  ),
  'CUT',
  'leaderboard-backed cut golfers should show CUT without a today score'
)

console.log('golfer status label checks passed')
