import assert from 'node:assert/strict'
import { buildPreviousPlayerCandidates, summarizeInviteStatuses } from '../src/lib/pool-invite-logic.ts'

const previousEntries = [
  { user_id: 'runner', display_name: 'Runner' },
  { user_id: 'alice', display_name: 'Alice' },
  { user_id: 'bob', display_name: 'Bobby' },
  { user_id: 'alice', display_name: 'Alice M.' },
  { user_id: 'carol', display_name: '' },
]

const candidates = buildPreviousPlayerCandidates({
  previousEntries,
  currentPoolEntryUserIds: ['bob'],
  existingInviteUserIds: ['carol'],
  ownerUserId: 'runner',
})

assert.deepEqual(candidates, [
  { userId: 'alice', displayName: 'Alice', sourcePoolIds: [] },
], 'filters owner/current entries/existing invites and dedupes prior players')

assert.deepEqual(summarizeInviteStatuses([
  { status: 'pending' },
  { status: 'pending' },
  { status: 'accepted' },
  { status: 'declined' },
  { status: 'expired' },
]), { pending: 2, accepted: 1, declined: 1 }, 'summarizes visible invite statuses')

console.log('pool invite logic verified')
