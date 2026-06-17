import assert from 'node:assert/strict'
import { isScoredFinalResultsEntry, selectFinalResultAnnouncement } from '../src/lib/final-result-announcements.ts'

const baseAnnouncement = {
  entryId: 'entry-1',
  poolId: 'pool-1',
  poolName: 'Four Fagarillos',
  tournamentName: 'PGA Championship',
  rank: 4,
  totalScore: -5,
  fieldSize: 12,
  scoredEntries: [],
}

assert.deepEqual(
  selectFinalResultAnnouncement([baseAnnouncement], new Set()),
  { ...baseAnnouncement, showSharePreview: true },
  'completed unseen top-five result should be selected and show share preview'
)

assert.equal(
  selectFinalResultAnnouncement([baseAnnouncement], new Set(['pool-1'])),
  null,
  'dismissed pool should never show again for that user'
)

assert.deepEqual(
  selectFinalResultAnnouncement([{ ...baseAnnouncement, poolId: 'pool-2', rank: 6 }], new Set()),
  { ...baseAnnouncement, poolId: 'pool-2', rank: 6, showSharePreview: false },
  'outside top five still shows finish popup but no share preview'
)

assert.deepEqual(
  selectFinalResultAnnouncement([
    { ...baseAnnouncement, poolId: 'pool-dismissed', rank: 1 },
    { ...baseAnnouncement, poolId: 'pool-next', rank: 2 },
  ], new Set(['pool-dismissed'])),
  { ...baseAnnouncement, poolId: 'pool-next', rank: 2, showSharePreview: true },
  'selection should skip dismissed results and choose the first remaining result'
)

assert.deepEqual(
  selectFinalResultAnnouncement([{ ...baseAnnouncement, poolId: 'pool-unscored', rank: 3, totalScore: null }], new Set()),
  null,
  'unscored final result should not show a blank-score popup'
)

assert.equal(isScoredFinalResultsEntry({ rank: 1, total_score: -12 }), true, 'ranked scored entries should be eligible for final-results email')
assert.equal(isScoredFinalResultsEntry({ rank: 1, total_score: 0 }), true, 'even-par scored entries should be eligible for final-results email')
assert.equal(isScoredFinalResultsEntry({ rank: null, total_score: null }), false, 'unscored entries should not receive final-results email with blank finish')
assert.equal(isScoredFinalResultsEntry({ rank: 2, total_score: null }), false, 'ranked entries without a frozen total should not receive final-results email')

console.log('final result announcement checks passed')
