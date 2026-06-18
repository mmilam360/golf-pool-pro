import assert from 'node:assert/strict'
import { sortTournamentLeaderboardRows, tournamentPositionLabel, tournamentScoreLabel } from '../src/lib/tournament-leaderboard-display.ts'

const now = new Date('2026-06-18T15:00:00Z')
const rows = [
  { id: 'not-started-even', name: 'Not Started', status: 'active', scoreToPar: 0, position: 'T1', teeTime: '2026-06-18T20:00:00Z', thru: '', roundScore: '' },
  { id: 'over-par-on-course', name: 'Over Par Playing', status: 'active', scoreToPar: 3, position: 'T80', teeTime: '2026-06-18T12:00:00Z', thru: '4', roundScore: '+3' },
  { id: 'under-par-finished', name: 'Finished Under', status: 'active', scoreToPar: -2, position: 'T5', teeTime: '2026-06-18T10:00:00Z', thru: 'F', roundScore: '-2' },
  { id: 'cut-player', name: 'Cut Player', status: 'cut', scoreToPar: 6, position: 'CUT', teeTime: '2026-06-18T10:00:00Z', thru: '', roundScore: '' },
]

const sortedIds = sortTournamentLeaderboardRows(rows, now).map(player => player.id)
assert.deepEqual(sortedIds, ['over-par-on-course', 'under-par-finished', 'not-started-even', 'cut-player'], 'active/on-course golfers show before not-started E golfers')
assert.equal(tournamentScoreLabel(rows[0], now), '', 'not-started golfers show a blank total score')
assert.equal(tournamentPositionLabel(rows[0], 0, now), '', 'not-started golfers do not get a fake position')
assert.equal(tournamentScoreLabel(rows[1], now), '+3', 'started golfers still show over-par scores')

console.log('tournament leaderboard display verified')
