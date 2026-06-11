import type { SupabaseClient } from '@supabase/supabase-js'
import type { GolfPlayer } from './golf-api'
import { scoreEntriesForLeaderboard } from './scoring'

export type FinalizeResult = {
  tournamentsChecked: number
  poolsChecked: number
  poolsFinalized: number
  entriesUpdated: number
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
  tournament_id: string
  count_scores: number | null
  ob_rule_enabled: boolean | null
  ob_penalty_strokes: number | null
  results_finalized_at?: string | null
}

type EntryRow = {
  id: string
  display_name: string | null
  golfer_picks: unknown
  is_removed?: boolean | null
}

function hasFrozenResults(pool: PoolRow) {
  return Boolean(pool.results_finalized_at)
}

function usableLeaderboard(leaderboard: unknown): leaderboard is GolfPlayer[] {
  return Array.isArray(leaderboard) && leaderboard.some(player =>
    player && typeof player === 'object' && typeof (player as GolfPlayer).name === 'string'
  )
}

function finalLeaderboardIsComplete(leaderboard: GolfPlayer[]) {
  const activePlayers = leaderboard.filter(player => player?.status === 'active')
  if (activePlayers.length === 0) return false

  return activePlayers.every(player => {
    if (String(player?.thru || '').toUpperCase() === 'F') return true
    const rounds = Array.isArray(player?.roundScores) ? player.roundScores : []
    const latestRound = [...rounds]
      .filter(round => Number.isFinite(Number(round?.round)))
      .sort((a, b) => Number(b.round) - Number(a.round))[0]

    return Number(latestRound?.round) >= 4 && Boolean(latestRound?.complete)
  })
}

export async function finalizeCompletedPoolResults(
  supabase: SupabaseClient,
  options: { tournamentIds?: string[]; now?: string } = {}
): Promise<FinalizeResult> {
  const now = options.now || new Date().toISOString()
  const result: FinalizeResult = {
    tournamentsChecked: 0,
    poolsChecked: 0,
    poolsFinalized: 0,
    entriesUpdated: 0,
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
    if (!usableLeaderboard(tournament.leaderboard_json) || !finalLeaderboardIsComplete(tournament.leaderboard_json)) {
      result.skipped++
      continue
    }

    const { data: pools, error: poolsError } = await supabase
      .from('gpp_pools')
      .select('id, tournament_id, count_scores, ob_rule_enabled, ob_penalty_strokes, results_finalized_at')
      .eq('tournament_id', tournament.id)

    if (poolsError) throw poolsError

    for (const pool of (pools || []) as PoolRow[]) {
      result.poolsChecked++
      if (hasFrozenResults(pool)) {
        result.skipped++
        continue
      }

      const { data: entries, error: entriesError } = await supabase
        .from('gpp_entries')
        .select('id, display_name, golfer_picks, is_removed')
        .eq('pool_id', pool.id)

      if (entriesError) throw entriesError

      const scoredEntries = scoreEntriesForLeaderboard(
        (entries || []) as EntryRow[],
        tournament.leaderboard_json,
        {
          countScores: Number(pool.count_scores || 0),
          obRuleEnabled: Boolean(pool.ob_rule_enabled),
          obPenaltyStrokes: Number(pool.ob_penalty_strokes || 0),
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
      const updateError = updateResults.find(item => item.error)?.error
      if (updateError) throw updateError

      const { error: poolUpdateError } = await supabase
        .from('gpp_pools')
        .update({
          is_completed: true,
          results_finalized_at: now,
          results_finalized_source: 'cron_finalizer',
        })
        .eq('id', pool.id)
        .is('results_finalized_at', null)

      if (poolUpdateError) throw poolUpdateError

      result.entriesUpdated += scoredEntries.length
      result.poolsFinalized++
    }
  }

  return result
}
