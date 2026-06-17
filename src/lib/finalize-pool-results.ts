import type { SupabaseClient } from '@supabase/supabase-js'
import type { GolfPlayer } from './golf-api'
import { scoreEntriesForLeaderboard } from './scoring'
import { finalBoardHasEnoughEvidence } from './leaderboard-sanity'
import { sendFinalResultsEmailsForPool } from './final-results-email'

export type FinalizeResult = {
  tournamentsChecked: number
  poolsChecked: number
  poolsFinalized: number
  entriesUpdated: number
  finalEmailsSent: number
  finalEmailsNoEmail: number
  skipped: number
}

type TournamentRow = {
  id: string
  name: string | null
  status: string | null
  leaderboard_json: GolfPlayer[] | null
}

type PoolRow = {
  id: string
  name?: string | null
  tournament_id: string
  count_scores: number | null
  pick_count: number | null
  ob_rule_enabled: boolean | null
  ob_penalty_strokes: number | null
  results_finalized_at?: string | null
  results_finalized_source?: string | null
}

type EntryRow = {
  id: string
  display_name: string | null
  golfer_picks: unknown
  is_removed?: boolean | null
}

const FINALIZE_LOCK_TIMEOUT_MS = 30 * 60 * 1000

function finalizingLockMs(source: string | null | undefined, nowMs: number) {
  if (!String(source || '').startsWith('finalizing:')) return null
  const lockedAt = new Date(String(source).slice('finalizing:'.length)).getTime()
  if (!Number.isFinite(lockedAt)) return null
  return nowMs - lockedAt
}

function hasActiveFinalizeLock(pool: PoolRow, nowMs: number) {
  const ageMs = finalizingLockMs(pool.results_finalized_source, nowMs)
  return ageMs !== null && ageMs >= 0 && ageMs < FINALIZE_LOCK_TIMEOUT_MS
}

function usableLeaderboard(leaderboard: unknown): leaderboard is GolfPlayer[] {
  return Array.isArray(leaderboard) && leaderboard.some(player =>
    player && typeof player === 'object' && typeof (player as GolfPlayer).name === 'string'
  )
}

async function addFinalEmailResult(result: FinalizeResult, promise: ReturnType<typeof sendFinalResultsEmailsForPool>) {
  const finalEmailResult = await promise
  result.finalEmailsSent += finalEmailResult.sent
  result.finalEmailsNoEmail += finalEmailResult.noEmail
}

export async function finalizeCompletedPoolResults(
  supabase: SupabaseClient,
  options: { tournamentIds?: string[]; now?: string } = {}
): Promise<FinalizeResult> {
  const now = options.now || new Date().toISOString()
  const nowMs = new Date(now).getTime()
  const result: FinalizeResult = {
    tournamentsChecked: 0,
    poolsChecked: 0,
    poolsFinalized: 0,
    entriesUpdated: 0,
    finalEmailsSent: 0,
    finalEmailsNoEmail: 0,
    skipped: 0,
  }

  let tournamentQuery = supabase
    .from('gpp_tournaments')
    .select('id, name, status, leaderboard_json')
    .eq('status', 'completed')
    .not('leaderboard_json', 'is', null)

  if (options.tournamentIds?.length) tournamentQuery = tournamentQuery.in('id', options.tournamentIds)

  const { data: tournaments, error: tournamentError } = await tournamentQuery
  if (tournamentError) throw tournamentError

  for (const tournament of (tournaments || []) as TournamentRow[]) {
    result.tournamentsChecked++
    if (!usableLeaderboard(tournament.leaderboard_json) || !finalBoardHasEnoughEvidence(tournament.leaderboard_json, 4)) {
      result.skipped++
      continue
    }

    const { data: pools, error: poolsError } = await supabase
      .from('gpp_pools')
      .select('id, name, tournament_id, count_scores, pick_count, ob_rule_enabled, ob_penalty_strokes, results_finalized_at, results_finalized_source')
      .eq('tournament_id', tournament.id)

    if (poolsError) throw poolsError

    for (const pool of (pools || []) as PoolRow[]) {
      result.poolsChecked++
      if (pool.results_finalized_at) {
        await addFinalEmailResult(result, sendFinalResultsEmailsForPool(supabase, { pool, tournament }))
        result.skipped++
        continue
      }
      if (hasActiveFinalizeLock(pool, nowMs)) {
        result.skipped++
        continue
      }

      if (pool.results_finalized_source) {
        const { error: releaseStaleLockError } = await supabase
          .from('gpp_pools')
          .update({ results_finalized_source: null })
          .eq('id', pool.id)
          .is('results_finalized_at', null)
          .eq('results_finalized_source', pool.results_finalized_source)
        if (releaseStaleLockError) throw releaseStaleLockError
      }

      const countScores = Number(pool.count_scores || pool.pick_count || 0)
      if (countScores <= 0) {
        result.skipped++
        continue
      }

      const lockToken = `finalizing:${now}`
      let lockClaimed = false
      try {
        const { data: claimedPools, error: claimError } = await supabase
          .from('gpp_pools')
          .update({ results_finalized_source: lockToken })
          .eq('id', pool.id)
          .is('results_finalized_at', null)
          .is('results_finalized_source', null)
          .select('id')

        if (claimError) throw claimError
        if (!claimedPools?.length) {
          result.skipped++
          continue
        }
        lockClaimed = true

        const { data: entries, error: entriesError } = await supabase
          .from('gpp_entries')
          .select('id, display_name, golfer_picks, is_removed')
          .eq('pool_id', pool.id)

        if (entriesError) throw entriesError

        const scoredEntries = scoreEntriesForLeaderboard(
          (entries || []) as EntryRow[],
          tournament.leaderboard_json,
          {
            countScores,
            obRuleEnabled: Boolean(pool.ob_rule_enabled),
            obPenaltyStrokes: Number(pool.ob_penalty_strokes ?? 2),
          }
        )

        const updates = scoredEntries.map(entry =>
          supabase
            .from('gpp_entries')
            .update({
              total_score: entry.totalScore,
              rank: entry.rank,
              counting_scores: entry.pickScores,
            })
            .eq('id', entry.entryId)
        )

        const updateResults = await Promise.all(updates)
        const updateError = updateResults.find((item: any) => item.error)?.error
        if (updateError) throw updateError

        await addFinalEmailResult(result, sendFinalResultsEmailsForPool(supabase, { pool, tournament }))

        const { data: finalizedPools, error: poolUpdateError } = await supabase
          .from('gpp_pools')
          .update({
            is_completed: true,
            results_finalized_at: now,
            results_finalized_source: 'cron_finalizer',
          })
          .eq('id', pool.id)
          .is('results_finalized_at', null)
          .eq('results_finalized_source', lockToken)
          .select('id')

        if (poolUpdateError) throw poolUpdateError
        if (!finalizedPools?.length) throw new Error(`Finalizer lock lost for pool ${pool.id}`)

        result.entriesUpdated += scoredEntries.length
        result.poolsFinalized++
      } catch (error) {
        if (lockClaimed) {
          await supabase
            .from('gpp_pools')
            .update({ results_finalized_source: null })
            .eq('id', pool.id)
            .is('results_finalized_at', null)
            .eq('results_finalized_source', lockToken)
        }
        throw error
      }
    }
  }

  return result
}
