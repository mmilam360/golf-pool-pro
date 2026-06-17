import assert from 'node:assert/strict'
import { validatePickSubmission } from '../src/lib/pick-submission-validation.ts'

const field = [
  { name: 'Scottie Scheffler', firstName: 'Scottie', lastName: 'Scheffler', status: 'active' },
  { name: 'Rory McIlroy', firstName: 'Rory', lastName: 'McIlroy', status: 'active' },
  { name: 'Jordan Spieth', firstName: 'Jordan', lastName: 'Spieth', status: 'wd' },
]

const standardPool = {
  game_format: 'standard',
  pick_count: 2,
  gpp_tournaments: { status: 'upcoming', field_json: field, leaderboard_json: [] },
}

assert.equal(validatePickSubmission(standardPool, ['Scottie Scheffler', 'Rory McIlroy']), null, 'standard picks from the field should pass')
assert.equal(validatePickSubmission(standardPool, ['Scottie Scheffler', 'Scottie Scheffler']), 'Pick each golfer only once.', 'duplicate standard picks should fail')
assert.equal(validatePickSubmission(standardPool, ['Scottie Scheffler']), 'Pick 2 golfers to save.', 'wrong standard pick count should fail')
assert.equal(validatePickSubmission(standardPool, ['Scottie Scheffler', 'Jordan Spieth']), 'Pick golfers from the tournament field.', 'withdrawn golfers should fail standard field validation')
assert.equal(validatePickSubmission({ ...standardPool, gpp_tournaments: { status: 'upcoming', field_json: [], leaderboard_json: [] } }, ['Scottie Scheffler', 'Rory McIlroy']), 'Tournament field is not ready yet.', 'standard picks should fail closed without a field')

const groupedPool = {
  game_format: 'ranked_groups',
  pick_count: 4,
  picks_per_group: 2,
  groups_finalized_at: '2026-06-16T12:00:00.000Z',
  pick_groups_json: [
    {
      id: 'group-1',
      label: 'Group 1',
      players: [
        { id: '1', name: 'Scottie Scheffler', rank: 1 },
        { id: '2', name: 'Rory McIlroy', rank: 2 },
      ],
    },
    {
      id: 'group-2',
      label: 'Group 2',
      players: [
        { id: '3', name: 'Collin Morikawa', rank: 3 },
        { id: '4', name: 'Ludvig Aberg', rank: 4 },
      ],
    },
  ],
}

assert.equal(validatePickSubmission(groupedPool, ['Scottie Scheffler', 'Rory McIlroy', 'Collin Morikawa', 'Ludvig Aberg']), null, 'grouped picks with exact group counts should pass')
assert.equal(validatePickSubmission(groupedPool, ['Scottie Scheffler', 'Rory McIlroy', 'Scottie Scheffler', 'Ludvig Aberg']), 'Pick each golfer only once.', 'duplicate grouped picks should fail')
assert.equal(validatePickSubmission(groupedPool, ['Scottie Scheffler', 'Rory McIlroy', 'Collin Morikawa', 'Jordan Spieth']), 'Pick golfers from the locked groups.', 'grouped picks outside locked groups should fail')
assert.equal(validatePickSubmission(groupedPool, ['Scottie Scheffler', 'Rory McIlroy', 'Collin Morikawa', 'Scottie Scheffler Jr.']), 'Pick golfers from the locked groups.', 'unknown grouped pick should fail before save')
assert.equal(validatePickSubmission(groupedPool, ['Scottie Scheffler', 'Rory McIlroy', 'Collin Morikawa']), 'Pick 4 golfers to save.', 'wrong grouped pick count should fail')
assert.equal(validatePickSubmission({ ...groupedPool, groups_finalized_at: null }, ['Scottie Scheffler', 'Rory McIlroy', 'Collin Morikawa', 'Ludvig Aberg']), 'Picks are not open yet. Groups need to lock first.', 'grouped picks should fail closed until groups lock')

console.log('pick submission validation checks passed')
