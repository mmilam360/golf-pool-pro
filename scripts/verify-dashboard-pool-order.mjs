import assert from 'node:assert/strict'
import { applySavedPoolOrder, movePoolId } from '../src/lib/dashboard-pool-order.ts'

assert.deepEqual(
  applySavedPoolOrder(['b', 'a'], ['a', 'b', 'c']),
  ['b', 'a', 'c'],
  'saved order should move known pools first and append new active pools'
)

assert.deepEqual(
  applySavedPoolOrder(['x', 'c'], ['a', 'b', 'c']),
  ['c', 'a', 'b'],
  'saved order should ignore pools that are no longer active'
)

assert.deepEqual(
  movePoolId(['a', 'b', 'c'], 'c', 'a'),
  ['c', 'a', 'b'],
  'dragging a pool over another should insert before the target pool'
)

assert.deepEqual(
  movePoolId(['a', 'b', 'c'], 'a', 'c'),
  ['b', 'a', 'c'],
  'dragging down should remove the source before inserting before the target'
)

assert.deepEqual(
  movePoolId(['a', 'b', 'c'], 'a', 'a'),
  ['a', 'b', 'c'],
  'dragging over itself should keep order unchanged'
)

console.log('dashboard pool ordering verified')
