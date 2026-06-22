import { lockedOrScoring, picksAreVisibleForPool, type PoolStateInput, type TournamentStateInput } from './pool-state'
import { submittedPickCount, type EntryPickFields } from './entry-picks'

export type PublicLeaderboardEntryInput = EntryPickFields & {
  id?: string | null
  pool_id?: string | null
  display_name?: string | null
  total_score?: number | null
  counting_scores?: unknown
  rank?: number | null
  is_removed?: boolean | null
  created_at?: string | null
  [key: string]: unknown
}

export type PublicLeaderboardState = {
  picksAreVisible: boolean
  preLockJoinOpen: boolean
}

export function derivePublicLeaderboardState(pool?: PoolStateInput | null, tournament?: TournamentStateInput | null, now = new Date()): PublicLeaderboardState {
  return {
    picksAreVisible: picksAreVisibleForPool(pool, tournament, now),
    preLockJoinOpen: !lockedOrScoring(pool, tournament),
  }
}

export function sanitizePublicLeaderboardEntry(entry: PublicLeaderboardEntryInput, picksAreVisible: boolean): PublicLeaderboardEntryInput & Record<string, unknown> {
  const pickCount = submittedPickCount(entry)
  const publicEntry: PublicLeaderboardEntryInput & Record<string, unknown> = {
    ...entry,
    user_id: null,
    full_name: null,
    full_name_confirmed_at: null,
    account_email: '',
    account_full_name: '',
    account_full_name_confirmed_at: null,
    notification_email: null,
    guest_entry_token_hash: null,
  }

  if (picksAreVisible) {
    return publicEntry
  }

  return {
    ...publicEntry,
    submitted_pick_count: pickCount,
    golfer_picks: [],
    picks_hidden: true,
  }
}

export function sanitizePublicLeaderboardEntries(entries: PublicLeaderboardEntryInput[] | null | undefined, picksAreVisible: boolean) {
  return (entries || []).map(entry => sanitizePublicLeaderboardEntry(entry, picksAreVisible))
}
