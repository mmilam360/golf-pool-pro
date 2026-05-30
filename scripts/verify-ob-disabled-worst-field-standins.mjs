import assert from 'node:assert/strict'
import { scoreEntry } from '../src/lib/scoring.ts'

const leaderboard = [
  { name: 'Leader', firstName: 'Leader', lastName: '', scoreToPar: -5, strokes: 0, thru: 'F', status: 'active', roundScore: '-2' },
  { name: 'Worst Active', firstName: 'Worst', lastName: 'Active', scoreToPar: 7, strokes: 0, thru: 'F', status: 'active', roundScore: '+4' },
  { name: 'Cut Guy', firstName: 'Cut', lastName: 'Guy', scoreToPar: 2, strokes: 0, thru: '', status: 'cut', roundScore: '' },
]

const disabled = scoreEntry(
  ['Leader', 'Cut Guy'],
  leaderboard,
  { countScores: 2, obRuleEnabled: false, obPenaltyStrokes: 2 }
)

assert.equal(disabled.totalScore, 2, 'OB disabled should still count a cut/DNQ pick as worst active field score with no extra penalty')
assert.equal(disabled.obStandIns, 1)
assert.equal(disabled.pickScores.find(pick => pick.name === 'Cut Guy')?.scoreToPar, 7)
assert.equal(disabled.pickScores.find(pick => pick.name === 'Cut Guy')?.counted, true)

const enabled = scoreEntry(
  ['Leader', 'Cut Guy'],
  leaderboard,
  { countScores: 2, obRuleEnabled: true, obPenaltyStrokes: 2 }
)

assert.equal(enabled.totalScore, 4, 'OB enabled should add configured penalty on top of worst active field score')
assert.equal(enabled.pickScores.find(pick => pick.name === 'Cut Guy')?.scoreToPar, 9)

console.log('OB disabled/enabled stand-in scoring checks passed')
