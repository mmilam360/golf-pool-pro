import assert from 'node:assert/strict'
import { finalizeCompletedPoolResults } from '../src/lib/finalize-pool-results.ts'

const calls = []

function queryResult(table) {
  if (table === 'gpp_tournaments') {
    return {
      data: [{
        id: 'tournament-1',
        name: 'Completed Tournament',
        status: 'completed',
        leaderboard_json: [{ name: 'Golfer One', thru: 'F', status: 'active', roundScores: [{ round: 4, complete: true }] }],
      }],
      error: null,
    }
  }

  if (table === 'gpp_pools') {
    return {
      data: [{
        id: 'pool-1',
        name: 'Already Finalized Pool',
        tournament_id: 'tournament-1',
        count_scores: 1,
        pick_count: 1,
        ob_rule_enabled: false,
        ob_penalty_strokes: 2,
        results_finalized_at: '2026-06-01T00:00:00.000Z',
        results_finalized_source: 'cron_finalizer',
      }],
      error: null,
    }
  }

  throw new Error(`Unexpected query to ${table}; finalized pools must not send/query final-result emails`)
}

function builder(table) {
  const chain = {
    select() { calls.push(`${table}.select`); return chain },
    eq() { return chain },
    is() { return chain },
    in() { return chain },
    update() { calls.push(`${table}.update`); return chain },
    order() { return chain },
    then(resolve, reject) { return Promise.resolve(queryResult(table)).then(resolve, reject) },
  }
  return chain
}

const supabase = {
  from(table) {
    calls.push(`${table}.from`)
    return builder(table)
  },
}

const result = await finalizeCompletedPoolResults(supabase, { now: '2026-06-21T00:00:00.000Z' })

assert.equal(result.tournamentsChecked, 1)
assert.equal(result.poolsChecked, 1)
assert.equal(result.skipped, 1)
assert.equal(result.finalEmailsSent, 0)
assert.equal(result.finalEmailsNoEmail, 0)
assert.equal(calls.some(call => call.startsWith('gpp_entries.')), false, 'already-finalized pools should not query entries/send final emails')

console.log('Final-result email resend guard verification passed')
