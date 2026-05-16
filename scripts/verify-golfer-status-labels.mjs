import assert from 'node:assert/strict'
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

console.log('golfer status label checks passed')
