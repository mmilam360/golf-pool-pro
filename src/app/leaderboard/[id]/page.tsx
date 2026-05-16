export const runtime = 'edge'

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PoolView from '@/app/(app)/pool/[id]/PoolView'
import { hasOnCourseScores } from '@/lib/golf-live'

export default async function PublicLeaderboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: pool } = await supabase
    .from('gpp_pools')
    .select('*, gpp_tournaments(*)')
    .eq('id', id)
    .single()

  if (!pool) notFound()

  const tournament = pool.gpp_tournaments as any
  const leaderboard = Array.isArray(tournament?.leaderboard_json) ? tournament.leaderboard_json : []
  const scoringIsLive = tournament?.status === 'live' || tournament?.status === 'completed' || hasOnCourseScores(leaderboard)
  const picksAreVisible = pool.is_locked || scoringIsLive

  const { data: entries } = await supabase
    .from('gpp_entries')
    .select('*')
    .eq('pool_id', id)
    .eq('is_removed', false)
    .order('created_at', { ascending: true })

  const safeEntries = (entries || []).map(entry => {
    const submittedPickCount = Array.isArray(entry.golfer_picks) ? entry.golfer_picks.length : 0
    if (picksAreVisible) return entry
    return {
      ...entry,
      submitted_pick_count: submittedPickCount,
      golfer_picks: [],
      picks_hidden: true,
    }
  })

  return (
    <main className="min-h-screen bg-[#fbf7ed] px-4 py-6 text-[#1f2a24] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <PoolView
          pool={pool}
          tournament={tournament}
          entries={safeEntries}
          myEntry={null}
          isOwner={false}
          userId=""
          previousPlayerCandidates={[]}
          inviteSummary={{ pending: 0, accepted: 0, declined: 0 }}
          publicView
        />
      </div>
    </main>
  )
}
