export const runtime = 'edge'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PoolView from '@/app/(app)/pool/[id]/PoolView'
import { hydrateFinalLeaderboard } from '@/lib/fresh-final-leaderboard'
import { derivePublicLeaderboardState, sanitizePublicLeaderboardEntries } from '@/lib/public-leaderboard-state'

export default async function PublicLeaderboardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ entry?: string }> }) {
  const { id } = await params
  const query = searchParams ? await searchParams : {}
  const highlightedEntryId = typeof query?.entry === 'string' && /^[0-9a-f-]{36}$/i.test(query.entry) ? query.entry : null
  const supabase = await createClient()

  const [poolResult, entriesResult] = await Promise.all([
    supabase
      .from('gpp_pools')
      .select('id, tournament_id, name, pick_count, count_scores, is_locked, is_completed, results_finalized_at, game_format, group_count, picks_per_group, pick_groups_json, groups_finalized_at, ob_rule_enabled, ob_penalty_strokes, payment_status, amount_paid_cents')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('gpp_entries')
      .select('id, pool_id, display_name, golfer_picks, submitted_pick_count, total_score, counting_scores, rank, is_removed, created_at')
      .eq('pool_id', id)
      .eq('is_removed', false)
      .order('created_at', { ascending: true }),
  ])
  if (poolResult.error) throw poolResult.error
  if (entriesResult.error) throw entriesResult.error

  const pool = poolResult.data as any
  if (!pool) notFound()

  const { data: tournamentData, error: tournamentError } = await supabase
    .from('gpp_tournaments')
    .select('id, external_id, name, course, location, start_date, end_date, status, field_json, leaderboard_json, cut_score, last_scores_fetch')
    .eq('id', pool.tournament_id)
    .maybeSingle()
  if (tournamentError) throw tournamentError

  const tournament = await hydrateFinalLeaderboard(tournamentData as any)
  const publicPool = {
    id: pool.id,
    name: pool.name,
    pick_count: pool.pick_count,
    count_scores: pool.count_scores,
    is_locked: pool.is_locked,
    is_completed: pool.is_completed,
    results_finalized_at: pool.results_finalized_at,
    game_format: pool.game_format,
    group_count: pool.group_count,
    picks_per_group: pool.picks_per_group,
    pick_groups_json: pool.pick_groups_json,
    groups_finalized_at: pool.groups_finalized_at,
    ob_rule_enabled: pool.ob_rule_enabled,
    ob_penalty_strokes: pool.ob_penalty_strokes,
    payment_status: pool.payment_status,
    amount_paid_cents: Number(pool.amount_paid_cents || 0),
    passcode: '',
  }
  const { picksAreVisible, preLockJoinOpen } = derivePublicLeaderboardState(publicPool, tournament)
  const joinHref = `/pool/join?pool=${encodeURIComponent(pool.id)}`
  const signInHref = `/login?redirect=${encodeURIComponent('/dashboard')}`

  const { data: entries } = entriesResult
  const safeEntries = sanitizePublicLeaderboardEntries((entries || []) as any[], picksAreVisible)

  return (
    <main className="min-h-screen bg-[#fbf7ed] px-4 py-6 text-[#1f2a24] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {preLockJoinOpen && (
          <section className="mb-6 border-2 border-[#123c2f] bg-white p-4 shadow-[5px_5px_0_#d8cab0] sm:flex sm:items-center sm:justify-between sm:gap-4">
            <p className="font-display text-2xl font-black uppercase leading-tight text-[#123c2f]">Trying to join this pool?</p>
            <div className="mt-4 flex flex-col gap-2 sm:mt-0 sm:min-w-[180px]">
              <Link href={joinHref} className="border-2 border-[#123c2f] bg-[#123c2f] px-4 py-3 text-center text-sm font-black uppercase tracking-[0.08em] text-white hover:bg-[#0f2f25]">Join pool</Link>
              <Link href={signInHref} className="border border-[#d8cab0] bg-[#fbf7ed] px-4 py-2 text-center text-xs font-black uppercase tracking-[0.08em] text-[#123c2f] hover:border-[#123c2f] hover:bg-white">Sign in</Link>
            </div>
          </section>
        )}
        <PoolView
          pool={publicPool}
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
        {!preLockJoinOpen && (
          <section className="mt-8 border-2 border-[#123c2f] bg-[#123c2f] p-5 text-white shadow-[5px_5px_0_#d8cab0] sm:flex sm:items-center sm:justify-between sm:gap-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#f3df9c]">Like this board?</p>
              <h2 className="mt-1 font-display text-2xl font-black uppercase leading-tight">Start one for your group.</h2>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#e8dfcb]">Create a pool, send the passcode, and let the leaderboard update itself during the tournament.</p>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:mt-0 sm:min-w-[180px]">
              <Link href="/signup" className="inline-flex justify-center border-2 border-[#f3df9c] bg-[#f3df9c] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#123c2f] hover:bg-white">Start a pool</Link>
              <Link href={signInHref} className="inline-flex justify-center border border-[#f3df9c] bg-[#123c2f] px-5 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#f3df9c] hover:bg-[#0f2f25]">Sign in</Link>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
