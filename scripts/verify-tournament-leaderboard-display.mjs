import assert from 'node:assert/strict'
import { sortTournamentLeaderboardRows, tournamentPositionLabel, tournamentScoreLabel } from '../src/lib/tournament-leaderboard-display.ts'

const now = new Date('2026-06-19T15:00:00Z')
const rows = [
  { id: 'not-started-even', name: 'Not Started', status: 'active', scoreToPar: 0, position: 'T1', teeTime: '2026-06-19T20:00:00Z', thru: '', roundScore: '', roundScores: [] },
  { id: 'over-par-on-course', name: 'Over Par Playing', status: 'active', scoreToPar: 3, position: 'T80', teeTime: '2026-06-18T12:00:00Z', thru: '4', roundScore: '+3' },
  { id: 'under-par-finished', name: 'Finished Under', status: 'active', scoreToPar: -2, position: 'T5', teeTime: '2026-06-18T10:00:00Z', thru: 'F', roundScore: '-2' },
  { id: 'prior-round-waiting', name: 'Prior Round Waiting', status: 'active', scoreToPar: 10, position: '143', teeTime: '2026-06-19T20:30:00Z', thru: '', roundScore: '', roundScores: [{ round: 1, roundScoreToPar: 10, cumulativeScoreToPar: 10, complete: true }] },
  { id: 'cut-player', name: 'Cut Player', status: 'cut', scoreToPar: 6, position: 'CUT', teeTime: '2026-06-18T10:00:00Z', thru: '', roundScore: '' },
]

const sortedIds = sortTournamentLeaderboardRows(rows, now).map(player => player.id)
assert.deepEqual(sortedIds, ['under-par-finished', 'over-par-on-course', 'prior-round-waiting', 'not-started-even', 'cut-player'], 'full tournament leaderboard keeps scored prior-round players in score order while opening-round not-started golfers stay below scored golfers')
assert.equal(tournamentScoreLabel(rows[0], now), '', 'not-started golfers show a blank total score')
assert.equal(tournamentPositionLabel(rows[0], 0, now), '', 'not-started golfers do not get a fake position')
assert.equal(tournamentScoreLabel(rows[1], now), '+3', 'started golfers still show over-par scores')
assert.equal(tournamentScoreLabel(rows[3], now), '+10', 'players waiting for the next round still show their prior-round total')
assert.equal(tournamentPositionLabel(rows[3], 2, now), '143', 'players waiting for the next round still show their official position')

const duplicatedRows = [rows[2], rows[1], rows[1], rows[0], rows[0]]
const dedupedIds = sortTournamentLeaderboardRows(duplicatedRows, now).map(player => player.id)
assert.deepEqual(dedupedIds, ['under-par-finished', 'over-par-on-course', 'not-started-even'], 'duplicate full-field rows are removed by golfer identity')

const tiedRows = sortTournamentLeaderboardRows([
  { id: 'leader', name: 'Leader', status: 'active', scoreToPar: -7, position: '1', teeTime: '2026-06-18T10:00:00Z', thru: 'F', roundScore: '-1' },
  { id: 'tie-a', name: 'Tie A', status: 'active', scoreToPar: -3, position: '2', teeTime: '2026-06-18T10:00:00Z', thru: 'F', roundScore: '-4' },
  { id: 'tie-b', name: 'Tie B', status: 'active', scoreToPar: -3, position: '3', teeTime: '2026-06-18T10:00:00Z', thru: 'F', roundScore: 'E' },
  { id: 'next', name: 'Next', status: 'active', scoreToPar: -2, position: '4', teeTime: '2026-06-18T10:00:00Z', thru: 'F', roundScore: '-5' },
], now)
assert.equal(tournamentPositionLabel(tiedRows[0], 0, tiedRows, now), '1', 'single leader should show position 1')
assert.equal(tournamentPositionLabel(tiedRows[1], 1, tiedRows, now), 'T2', 'same-score golfers should share a tied tournament position')
assert.equal(tournamentPositionLabel(tiedRows[2], 2, tiedRows, now), 'T2', 'second same-score golfer should share the tied tournament position')
assert.equal(tournamentPositionLabel(tiedRows[3], 3, tiedRows, now), '4', 'rank after a two-player tie should use golf competition ranking')

const weekendStatusRows = sortTournamentLeaderboardRows([
  { id: 'leader', name: 'Leader', status: 'active', scoreToPar: -7, position: '1', thru: 'F', roundScore: '-2', roundScores: [{ round: 3, complete: true }] },
  { id: 'stale-cut', name: 'Made Cut Golfer', status: 'cut', scoreToPar: -3, position: 'CUT', thru: '8', roundScore: '-1', roundScores: [{ round: 3, complete: false }] },
  { id: 'true-cut', name: 'True Cut Golfer', status: 'cut', scoreToPar: 2, position: 'CUT', thru: '', roundScore: '', roundScores: [{ round: 1, complete: true }, { round: 2, complete: true }] },
], now)
assert.equal(weekendStatusRows[1].id, 'stale-cut', 'full tournament board keeps a made-cut golfer in live score order')
assert.equal(weekendStatusRows[1].status, 'active', 'full tournament board repairs stale CUT status when round-three evidence exists')
assert.equal(tournamentPositionLabel(weekendStatusRows[1], 1, weekendStatusRows, now), '2', 'repaired made-cut golfer receives a live tournament position instead of CUT')
assert.equal(weekendStatusRows[2].status, 'cut', 'full tournament board preserves a true two-round missed cut')
assert.equal(tournamentPositionLabel(weekendStatusRows[2], 2, weekendStatusRows, now), 'CUT', 'true missed cut still displays CUT')

console.log('tournament leaderboard display verified')
