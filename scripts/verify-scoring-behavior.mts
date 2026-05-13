import assert from 'node:assert/strict'
import scoring from '../src/lib/scoring.ts'
import type { GolfPlayer } from '../src/lib/golf-api.ts'

const { scoreEntry } = scoring as any

function player(name: string, scoreToPar: number | null, status: GolfPlayer['status']): GolfPlayer {
  const [firstName, ...rest] = name.split(' ')
  return {
    id: name,
    name,
    firstName,
    lastName: rest.join(' ') || firstName,
    scoreToPar,
    thru: status === 'cut' ? 'CUT' : 'F',
    status,
    position: '',
    strokes: null,
    today: null,
  }
}

const leaderboard = [
  player('Alpha One', -5, 'active'),
  player('Bravo Two', 0, 'active'),
  player('Charlie Three', 4, 'active'),
  player('Delta Four', 7, 'active'),
  player('Cut Player', 8, 'cut'),
  player('WD Player', null, 'wd'),
]

const cutOnly = scoreEntry(['Alpha One', 'Bravo Two', 'Cut Player', 'WD Player'], leaderboard, {
  countScores: 4,
  obRuleEnabled: true,
  obPenaltyStrokes: 2,
})
assert.equal(cutOnly.obStandIns, 1, 'Only missed-cut picks should create OB stand-ins')
assert.equal(cutOnly.pickScores.filter((p: any) => p.isObStandIn).length, 1)
assert.equal(cutOnly.totalScore, null, 'A WD/missing pick should not be silently converted into an OB stand-in')

const noCut = scoreEntry(['Alpha One', 'Bravo Two', 'WD Player'], leaderboard, {
  countScores: 3,
  obRuleEnabled: true,
  obPenaltyStrokes: 2,
})
assert.equal(noCut.obStandIns, 0, 'WD/DNQ alone should not trigger OB stand-ins')
assert.equal(noCut.totalScore, null)

console.log('scoring behavior ok')
