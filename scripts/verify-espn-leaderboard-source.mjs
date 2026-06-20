import { readFileSync } from 'node:fs'
import { applyOfficialCutPlayerStatuses, applyOfficialCutStatus, mapCompetitorToPlayer, parseOfficialCutPlayerIdsFromHtml, parseProjectedCutLineFromHtml } from '../src/lib/golf-api.ts'
import { repairWeekendCutStatuses } from '../src/lib/leaderboard-sanity.ts'

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

const cutLine = parseProjectedCutLineFromHtml('{"cut":{"score":"+3","count":72,"proj":true},"ldrs":[]}')
assert(cutLine?.score === '+3', 'parses ESPN projected cut score')
assert(cutLine?.scoreToPar === 3, `parses projected cut to par, got ${cutLine?.scoreToPar}`)
assert(cutLine?.count === 72, `parses projected cut count, got ${cutLine?.count}`)
assert(cutLine?.projected === true, 'parses projected cut flag')

const postCutHtml = '{"name":"Made Cut","id":"made","toPar":"+4","status":"post"},{"name":"Missed Cut A","id":"cut-a","toPar":"+5","status":"post","cut":true,"detail":"CUT"},{"name":"Missed Cut B","id":"cut-b","toPar":"+7","status":"post","cut":true,"detail":"CUT"}'
const officialCutIds = parseOfficialCutPlayerIdsFromHtml(postCutHtml)
assert(officialCutIds.has('cut-a') && officialCutIds.has('cut-b') && officialCutIds.size === 2, 'parses ESPN per-player official cut flags')
const officialCutLine = parseProjectedCutLineFromHtml(postCutHtml)
assert(officialCutLine?.score === '+4', `infers official cut line from ESPN cut flags, got ${officialCutLine?.score}`)
assert(officialCutLine?.projected === false, 'official cut flags produce a non-projected cut line')

const weekendPlayerOverCutLine = mapCompetitorToPlayer({
  id: 'weekend-over-cut-line',
  athlete: { displayName: 'Weekend Player' },
  score: '+7',
  linescores: [
    { period: 1, displayValue: '+2', linescores: Array.from({ length: 18 }, (_, index) => ({ period: index + 1, value: 4 })) },
    { period: 2, displayValue: '+3', linescores: Array.from({ length: 18 }, (_, index) => ({ period: index + 1, value: 4 })) },
    { period: 3, displayValue: '+1', linescores: Array.from({ length: 18 }, (_, index) => ({ period: index + 1, value: 4 })) },
    { period: 4, displayValue: '+1', linescores: Array.from({ length: 18 }, (_, index) => ({ period: index + 1, value: 4 })) },
  ],
})
const missedCutPlayer = mapCompetitorToPlayer({
  id: 'missed-cut',
  order: 54,
  athlete: { displayName: 'Missed Cut' },
  score: '+7',
  linescores: [
    { period: 1, displayValue: '+3', linescores: Array.from({ length: 18 }, (_, index) => ({ period: index + 1, value: 4 })) },
    { period: 2, displayValue: '+4', linescores: Array.from({ length: 18 }, (_, index) => ({ period: index + 1, value: 4 })) },
  ],
})
const insideCutCountPlayer = mapCompetitorToPlayer({
  id: 'inside-cut-count',
  order: 20,
  athlete: { displayName: 'Inside Cut Count' },
  score: '+4',
  linescores: [
    { period: 1, displayValue: '+2', linescores: Array.from({ length: 18 }, (_, index) => ({ period: index + 1, value: 4 })) },
    { period: 2, displayValue: '+2', linescores: Array.from({ length: 18 }, (_, index) => ({ period: index + 1, value: 4 })) },
  ],
})
const officialCutApplied = applyOfficialCutStatus([weekendPlayerOverCutLine, missedCutPlayer, insideCutCountPlayer], { score: '+5', scoreToPar: 5, count: 53, projected: false })
assert(officialCutApplied[0].status === 'active', 'keeps players active when they have weekend-round evidence')
assert(officialCutApplied[1].status === 'cut', 'still marks players cut when they missed the official cut')
assert(officialCutApplied[2].status === 'active', 'does not mark players cut when they are inside the official cut count')

const officialCutFlagApplied = applyOfficialCutPlayerStatuses([missedCutPlayer, insideCutCountPlayer], new Set(['missed-cut']))
assert(officialCutFlagApplied[0].status === 'cut', 'applies ESPN per-player official cut status')
assert(officialCutFlagApplied[0].roundScore === '' && officialCutFlagApplied[0].thru === '', 'official cut rows do not look like active finished rounds')
assert(officialCutFlagApplied[1].status === 'active', 'official cut flags do not affect unlisted players')

const explicitCutWithWeekendEvidence = { ...weekendPlayerOverCutLine, status: 'cut', position: 'CUT' }
const repairedCutStatus = repairWeekendCutStatuses([explicitCutWithWeekendEvidence])
assert(repairedCutStatus[0].status === 'active', 'repairs ESPN/stored CUT status when weekend round evidence exists')
assert(repairedCutStatus[0].position === 'CUT', 'repair does not invent rank data when only stored CUT position exists')

const golfApi = readFileSync(new URL('../src/lib/golf-api.ts', import.meta.url), 'utf8')
const tournamentSync = readFileSync(new URL('../src/lib/tournament-sync.ts', import.meta.url), 'utf8')
assert(!golfApi.includes('pgatour-api'), 'golf-api should not use PGA Tour leaderboard APIs')
assert(!tournamentSync.includes('pgatour-api'), 'tournament-sync should not use PGA Tour field APIs')
assert(!tournamentSync.includes('pgachampionship.com/players'), 'tournament-sync should not scrape PGA Championship player page')
assert(
  golfApi.includes('competitors/${playerId}/linescores?lang=en&region=us`, NEXT_NO_STORE'),
  'per-player linescore fetch must be no-store so today/thru does not lag behind total score'
)

console.log('ESPN leaderboard source verification passed')
