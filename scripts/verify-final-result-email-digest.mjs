import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const finalizer = readFileSync('src/lib/finalize-pool-results.ts', 'utf8')
const finalResultsEmail = readFileSync('src/lib/final-results-email.ts', 'utf8')
const transactionalEmails = readFileSync('src/lib/pool-transactional-emails.ts', 'utf8')

assert.ok(
  finalizer.includes("import { sendFinalResultsEmailsForPools } from './final-results-email'"),
  'finalizer should use the tournament/pool batch final-results sender',
)
assert.ok(
  finalizer.includes('const emailPoolsById = new Map<string, PoolRow>()'),
  'finalizer should collect finalized pools before sending final-results emails',
)
assert.ok(
  finalizer.includes('sendFinalResultsEmailsForPools(supabase, {\n      pools: Array.from(emailPoolsById.values()),\n      tournament,'),
  'finalizer should send final-results emails once after the tournament pool loop',
)
assert.equal(
  finalizer.includes('sendFinalResultsEmailsForPool(supabase'),
  false,
  'finalizer should not send final-results emails inside each pool finalization',
)

assert.ok(
  finalResultsEmail.includes("import { sendFinalResultsDigestEmail } from '@/lib/pool-transactional-emails'"),
  'final-results sender should use the digest email template',
)
assert.ok(
  finalResultsEmail.includes('const groups = new Map<string,'),
  'final-results sender should group reserved results by recipient',
)
assert.ok(
  finalResultsEmail.includes('const key = normalizedRecipient(recipient)'),
  'final-results sender should consolidate case-insensitive recipient matches',
)
assert.ok(
  finalResultsEmail.includes('dedupeKey: `final_results:${pool.id}:${entry.id}`'),
  'final-results sender should keep per-entry dedupe rows',
)
assert.ok(
  finalResultsEmail.includes("delivery: 'digest'"),
  'final-results events should mark digest delivery in payload',
)
assert.ok(
  finalResultsEmail.includes('result.sent++'),
  'final-results result should count provider emails, not per-entry rows',
)

assert.ok(
  transactionalEmails.includes('export async function sendFinalResultsDigestEmail'),
  'transactional emails should expose final-results digest sender',
)
assert.ok(
  transactionalEmails.includes('if (results.length === 1)'),
  'digest sender should preserve the existing one-result email layout',
)
assert.ok(
  transactionalEmails.includes('const subject = `Final results for ${tournamentName}`'),
  'multi-result digest subject should be tournament-level',
)
assert.ok(
  transactionalEmails.includes('Your results:'),
  'multi-result digest text should list all results',
)

console.log('final-result email digest verified')
