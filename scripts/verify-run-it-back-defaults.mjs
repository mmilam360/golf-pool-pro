import assert from 'node:assert/strict'
import { buildRunItBackDefaults } from '../src/lib/run-it-back.ts'

const defaults = buildRunItBackDefaults({
  id: 'pool-1',
  name: 'Four Fagarillos',
  pick_count: 10,
  count_scores: 6,
  ob_rule_enabled: true,
  ob_penalty_strokes: 3,
})

assert.deepEqual(defaults, {
  sourceId: 'pool-1',
  sourceName: 'Four Fagarillos',
  poolName: 'Four Fagarillos',
  pickCount: 10,
  countScores: 6,
  obEnabled: true,
  obPenalty: 3,
}, 'run it back should preserve pool name, pick/count settings, and OB rule settings')

assert.deepEqual(
  buildRunItBackDefaults({
    id: 'pool-2',
    name: 'No OB League',
    pick_count: 8,
    count_scores: 10,
    ob_rule_enabled: false,
    ob_penalty_strokes: 4,
  }),
  {
    sourceId: 'pool-2',
    sourceName: 'No OB League',
    poolName: 'No OB League',
    pickCount: 8,
    countScores: 8,
    obEnabled: false,
    obPenalty: 4,
  },
  'run it back should keep OB disabled and clamp counted golfers to picked golfers'
)

assert.deepEqual(
  buildRunItBackDefaults({
    id: 'pool-3',
    name: 'Legacy League',
    pick_count: 12,
    count_scores: 8,
    ob_rule_enabled: null,
    ob_penalty_strokes: null,
  }),
  {
    sourceId: 'pool-3',
    sourceName: 'Legacy League',
    poolName: 'Legacy League',
    pickCount: 12,
    countScores: 8,
    obEnabled: false,
    obPenalty: 2,
  },
  'run it back should preserve nullable legacy OB settings as disabled'
)

assert.equal(buildRunItBackDefaults({ name: 'Missing id' }), null, 'missing source id is not cloneable')

console.log('run it back defaults checks passed')
