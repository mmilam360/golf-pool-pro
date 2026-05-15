import { readFileSync } from 'node:fs'
import { mapCompetitorToPlayer } from '../src/lib/golf-api.ts'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const competitor = {
  id: '5080439',
  order: 1,
  athlete: {
    displayName: 'Aldrich Potgieter',
    flag: { alt: 'South Africa' },
  },
  score: '-4',
  linescores: [
    { period: 1, value: 67, displayValue: '-3', linescores: Array.from({ length: 18 }, (_, index) => ({ period: index + 1, value: 4 })) },
    { period: 2, value: 15, displayValue: '-1', linescores: Array.from({ length: 4 }, (_, index) => ({ period: index + 1, value: 4 })) },
    { period: 3 },
  ],
}

const player = mapCompetitorToPlayer(competitor)
assert(player.name === 'Aldrich Potgieter', 'maps ESPN athlete name')
assert(player.scoreToPar === -4, `maps total score to par, got ${player.scoreToPar}`)
assert(player.roundScore === '-1', `maps current-round score to par, got ${player.roundScore}`)
assert(player.thru === '4', `maps thru holes from ESPN current-round hole list, got ${player.thru}`)
assert(player.position === '1', `maps leaderboard position, got ${player.position}`)

const backNinePlayer = mapCompetitorToPlayer({
  id: 'back-nine',
  athlete: { displayName: 'Back Nine Starter' },
  score: 'E',
  linescores: [
    { period: 2, displayValue: 'E', linescores: Array.from({ length: 9 }, (_, index) => ({ period: index + 10, value: 4 })) },
  ],
})
assert(backNinePlayer.thru === '9*', `keeps ESPN-style back-nine thru marker, got ${backNinePlayer.thru}`)

const finishedPlayer = mapCompetitorToPlayer({
  id: 'finished',
  athlete: { displayName: 'Finished Round' },
  score: '-2',
  linescores: [
    { period: 2, displayValue: '-2', linescores: Array.from({ length: 18 }, (_, index) => ({ period: index + 1, value: 4 })) },
  ],
})
assert(finishedPlayer.thru === 'F', `maps 18 completed holes to F, got ${finishedPlayer.thru}`)

const golfApi = readFileSync(new URL('../src/lib/golf-api.ts', import.meta.url), 'utf8')
const tournamentSync = readFileSync(new URL('../src/lib/tournament-sync.ts', import.meta.url), 'utf8')
assert(!golfApi.includes('pgatour-api'), 'golf-api should not use PGA Tour leaderboard APIs')
assert(!tournamentSync.includes('pgatour-api'), 'tournament-sync should not use PGA Tour field APIs')
assert(!tournamentSync.includes('pgachampionship.com/players'), 'tournament-sync should not scrape PGA Championship player page')

console.log('ESPN leaderboard source verification passed')
