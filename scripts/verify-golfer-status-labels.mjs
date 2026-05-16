import assert from 'node:assert/strict'
import { pickStatusLabel, teeTimeLabel, tournamentThruLabel } from '../src/lib/golfer-status.ts'

const timeZone = 'America/New_York'
const now = new Date('2026-05-16T22:00:00Z') // 6:00 PM ET

assert.equal(
  pickStatusLabel({ teeTime: '2026-05-16T14:00:00Z', scoreToPar: -2, thru: '', status: 'active', isObStandIn: false }, timeZone, now),
  'F',
  'finished same-day golfer with cleared thru should show F until midnight reset'
)

assert.equal(
  tournamentThruLabel({ teeTime: '2026-05-16T14:00:00Z', scoreToPar: -2, thru: '', status: 'active' }, timeZone, now),
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
  pickStatusLabel({ teeTime: '2026-05-16T14:00:00Z', scoreToPar: -2, thru: '', status: 'active', isObStandIn: false }, timeZone, new Date('2026-05-17T04:01:00Z')),
  '—',
  'after local midnight reset, old same-day F fallback should clear'
)

assert.equal(
  tournamentThruLabel({ teeTime: '2026-05-16T23:40:00Z', thru: 'F', scoreToPar: -4, status: 'active' }, timeZone, now),
  '—',
  'full tournament thru cell should not show stale F before future tee time'
)

assert.equal(
  teeTimeLabel({ teeTime: '2026-05-16T14:00:00Z', thru: '', status: 'active' }, timeZone, now),
  '',
  'past tee times should not display as tee times'
)

assert.equal(
  pickStatusLabel({ isObStandIn: true, thru: 'F', status: 'active' }, timeZone, now),
  'OB',
  'OB stand-in still wins'
)

console.log('golfer status label checks passed')
