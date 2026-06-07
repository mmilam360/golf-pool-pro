export const runtime = 'edge'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PoolView from '@/app/(app)/pool/[id]/PoolView'
import { hasOnCourseScores } from '@/lib/golf-live'
import { hydrateFinalLeaderboard } from '@/lib/fresh-final-leaderboard'

export default async function PublicLeaderboardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ entry?: string }> }) {
  const { id } = await params
  const query = searchParams ? await searchParams : {}
  const highlightedEntryId = typeof query?.entry === 'string' && /^[0-9a-f-]{36}$/i.test(query.entry) ? query.entry : null
  const supabase = await createClient()

  const { data: pool } = await supabase
    .from('gpp_pools')
    .select('*, gpp_tournaments(*)')
    .eq('id', id)
    .single()

  if (!pool) notFound()

  const tournament = await hydrateFinalLeaderboard(pool.gpp_tournaments as any)
  pool.gpp_tournaments = tournament
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
        <section className="mb-6 border-2 border-[#123c2f] bg-white p-4 shadow-[5px_5px_0_#d8cab0] sm:flex sm:items-center sm:justify-between sm:gap-5 sm:p-5">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a6724]">Golf Pools Pro</p>
            <h1 className="mt-1 font-display text-2xl font-black uppercase leading-tight text-[#123c2f] sm:text-3xl">Run your own golf pool</h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#657168]">Live leaderboards, pick sheets, and shareable pool pages without the spreadsheet cleanup.</p>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:mt-0 sm:w-auto sm:min-w-[210px]">
            <Link href="/signup" className="border-2 border-[#123c2f] bg-[#123c2f] px-4 py-2 text-center text-sm font-black uppercase tracking-[0.08em] text-white hover:bg-[#0f2f25]">Create account</Link>
            <Link href="/" className="border-2 border-[#123c2f] bg-[#fbf7ed] px-4 py-2 text-center text-sm font-black uppercase tracking-[0.08em] text-[#123c2f] hover:bg-white">See how it works</Link>
          </div>
        </section>
        <PoolView
          pool={pool}
          tournament={tournament}
          entries={safeEntries}
          myEntry={null}
          isOwner={false}
          userId=""
          previousPlayerCandidates={[]}
          inviteSummary={{ pending: 0, accepted: 0, declined: 0 }}
          initialHighlightedEntryId={highlightedEntryId}
          publicView
        />
        <section className="mt-8 border-2 border-[#123c2f] bg-[#123c2f] p-5 text-white shadow-[5px_5px_0_#d8cab0] sm:flex sm:items-center sm:justify-between sm:gap-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#f3df9c]">Like this board?</p>
            <h2 className="mt-1 font-display text-2xl font-black uppercase leading-tight">Start one for your group.</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#e8dfcb]">Create a pool, send the passcode, and let the leaderboard update itself during the tournament.</p>
          </div>
          <Link href="/signup" className="mt-4 inline-flex border-2 border-[#f3df9c] bg-[#f3df9c] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#123c2f] hover:bg-white sm:mt-0">Start a pool</Link>
        </section>
      </div>
    </main>
  )
}
