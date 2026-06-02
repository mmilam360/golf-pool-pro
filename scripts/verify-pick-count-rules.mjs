import assert from 'node:assert/strict'

import { totalPicksRequired } from '../src/lib/pick-counts.ts'

assert.equal(
  totalPicksRequired({ game_format: 'standard', pick_count: 12, count_scores: 8 }),
  12,
  'standard pools should require pick_count, not count_scores'
)

assert.equal(
  totalPicksRequired({ game_format: 'standard', pick_count: 10, count_scores: 4 }),
  10,
  'custom standard pools should use their real pick_count'
)

assert.equal(
  totalPicksRequired({ game_format: 'ranked_groups', group_count: 6, picks_per_group: 2, count_scores: 8 }),
  12,
  'ranked grouped pools should require group_count × picks_per_group'
)

assert.equal(
  totalPicksRequired({ game_format: 'random_groups', group_count: 3, picks_per_group: 2, count_scores: 4 }),
  6,
  'random grouped pools should require group_count × picks_per_group'
)

assert.equal(
  totalPicksRequired({ game_format: 'ranked_groups', pick_groups_json: [{ picks_per_group: 2 }, { picks_per_group: 1 }], count_scores: 2 }),
  3,
  'stored grouped pool snapshots should use the snapshot requirements when present'
)

console.log('pick count rules verified')
