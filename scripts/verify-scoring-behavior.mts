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
    thru: status === 'cut' ? 'CUT' : status.toUpperCase(),
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

const cutAndWd = scoreEntry(['Alpha One', 'Bravo Two', 'Cut Player', 'WD Player'], leaderboard, {
  countScores: 4,
  obRuleEnabled: true,
  obPenaltyStrokes: 2,
})
assert.equal(cutAndWd.obStandIns, 2, 'Cut/WD/DNQ/missing picks should all create OB stand-ins when scores are needed')
assert.equal(cutAndWd.pickScores.filter((p: any) => p.isObStandIn).length, 2)
assert.equal(cutAndWd.totalScore, 13, 'Two active picks plus two worst+2 OB stand-ins should total correctly')

const missingAndDnq = scoreEntry(['Alpha One', 'Bravo Two', 'Missing Player', 'DNQ Player'], [
  ...leaderboard,
  player('DNQ Player', null, 'dnq'),
], {
  countScores: 4,
  obRuleEnabled: true,
  obPenaltyStrokes: 2,
})
assert.equal(missingAndDnq.obStandIns, 2, 'DNQ and missing leaderboard rows should also count as OB stand-ins')
assert.equal(missingAndDnq.totalScore, 13)

console.log('scoring behavior ok')
