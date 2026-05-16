import assert from 'node:assert/strict'
import { findPgaTourTournament, getPgaTourField, getPgaTourSchedule } from '../src/lib/pga-tour-field.ts'

const schedule = await getPgaTourSchedule(2026)
const cjCup = findPgaTourTournament({
  pgaSchedule: schedule,
  eventName: 'THE CJ CUP Byron Nelson',
  startDate: '2026-05-21T04:00Z',
})

assert.equal(cjCup?.tournamentId, 'R2026019')

const field = await getPgaTourField(cjCup.tournamentId)
assert.ok(field.length > 100, `expected early CJ Cup field, got ${field.length}`)
assert.ok(field[0]?.name && !field[0].name.includes(','), 'field names should be normalized as First Last')
assert.equal(field[0]?.score, 'E')
assert.equal(field[0]?.status === 'active' || field[0]?.status === 'wd', true)

console.log(`early PGA TOUR field checks passed (${field.length} players)`)
