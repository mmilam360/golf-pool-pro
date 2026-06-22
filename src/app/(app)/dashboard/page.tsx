export const runtime = 'edge';
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import DashboardActivePools from '@/components/DashboardActivePools'
import FinalResultPopup from '@/components/FinalResultPopup'
import ClaimedPromoBanner from '@/components/ClaimedPromoBanner'
import { formatDateOnly, getDateOnly, todayDateOnly } from '@/lib/date-utils'
import { selectNextRunItBackTournament } from '@/lib/run-it-back'
import { acceptPoolInvite, declinePoolInvite } from '@/app/(app)/pool-invites/actions'
import { dismissFinalResultAnnouncement } from '@/app/(app)/dashboard/final-result-actions'
import { scoreEntriesForLeaderboard, type ScoredEntry } from '@/lib/scoring'
import { selectFinalResultAnnouncement, type FinalResultAnnouncementCandidate } from '@/lib/final-result-announcements'
import { picksAreVisibleForPool, poolIsActiveForDashboard, tournamentHasScoringEvidence } from '@/lib/pool-state'
import type { GolfCutLine, GolfPlayer } from '@/lib/golf-api'
import { hydrateFinalLeaderboards } from '@/lib/fresh-final-leaderboard'
import { displayTournamentName } from '@/lib/tournament-name'
import { frozenResultsForEntries, hasCompleteFrozenResults } from '@/lib/frozen-results'

type Tournament = {
  id?: string | null
  name?: string | null
  external_id?: string | null
  start_date?: string | null
  end_date?: string | null
  status?: string | null
  field_json?: GolfPlayer[] | null
  leaderboard_json?: GolfPlayer[] | null
  last_scores_fetch?: string | null
  cutLine?: GolfCutLine | null
}

type PoolRecord = {
  id: string
  name: string
  passcode: string
  is_locked: boolean | null
  is_completed: boolean | null
  payment_status?: string | null
  amount_paid_cents?: number | null
  pick_count?: number | null
  count_scores?: number | null
  ob_rule_enabled?: boolean | null
  ob_penalty_strokes?: number | null
  game_format?: string | null
  group_count?: number | null
  picks_per_group?: number | null
  pick_groups_json?: unknown | null
  lock_at?: string | null
  groups_finalized_at?: string | null
  gpp_tournaments?: Tournament | Tournament[] | null
}

type EntryRecord = {
  id: string
  pool_id: string
  display_name: string | null
  golfer_picks: unknown
  counting_scores?: unknown
  total_score?: number | null
  rank?: number | null
  is_removed?: boolean | null
  picks_hidden?: boolean | null
  gpp_pools?: PoolRecord | PoolRecord[] | null
}

type PendingInviteRecord = {
  id: string
  pool_id: string
  status: string | null
  gpp_pools?: PoolRecord | PoolRecord[] | null
}

function getTournament(pool?: PoolRecord | null): Tournament | null {
  const tournament = pool?.gpp_tournaments
  return Array.isArray(tournament) ? tournament[0] ?? null : tournament ?? null
}

function getPool(entry: EntryRecord): PoolRecord | null {
  const pool = entry.gpp_pools
  return Array.isArray(pool) ? pool[0] ?? null : pool ?? null
}

function getInvitePool(invite: PendingInviteRecord): PoolRecord | null {
  const pool = invite.gpp_pools
  return Array.isArray(pool) ? pool[0] ?? null : pool ?? null
}

function tournamentId(pool?: PoolRecord | null) {
  return getTournament(pool)?.id || null
}

function attachTournamentJson(pool: PoolRecord, jsonByTournamentId: Map<string, Partial<Tournament>>) {
  const id = tournamentId(pool)
  if (!id) return
  const json = jsonByTournamentId.get(id)
  if (!json) return
  const tournament = getTournament(pool)
  if (!tournament) return
  Object.assign(tournament, json)
}

function uniqueTournamentIds(pools: PoolRecord[], predicate: (pool: PoolRecord, tournament: Tournament | null) => boolean) {
  return Array.from(new Set(
    pools
      .filter(pool => predicate(pool, getTournament(pool)))
      .map(pool => tournamentId(pool))
      .filter((id): id is string => Boolean(id))
  ))
}

function tournamentSortDate(pool?: PoolRecord | null) {
  const tournament = getTournament(pool)
  return tournament?.start_date || tournament?.end_date || ''
}


function formatDate(value?: string | null) {
  return formatDateOnly(value)
}

function formatShortDate(value?: string | null, includeYear = false) {
  const dateOnly = getDateOnly(value || '')
  if (!dateOnly) return 'TBD'
  const [year, month, day] = dateOnly.split('-').map(Number)
  if (!year || !month || !day) return formatDateOnly(value)
  return includeYear ? `${month}/${day}/${String(year).slice(-2)}` : `${month}/${day}`
}

function formatDateRange(start?: string | null, end?: string | null) {
  const startOnly = getDateOnly(start || '')
  const endOnly = getDateOnly(end || '')
  if (!endOnly || startOnly === endOnly) return formatShortDate(start, true)
  return `${formatShortDate(start)}–${formatShortDate(end, true)}`
}

function isActivePool(pool: PoolRecord, tournament: Tournament | null) {
  return poolIsActiveForDashboard(pool, tournament)
}

function shouldHydrateActiveTournamentJson(pool: PoolRecord, tournament: Tournament | null) {
  if (isActivePool(pool, tournament)) return true
  if (pool.is_completed || tournament?.status === 'completed' || !tournament?.start_date) return false

  const today = todayDateOnly()
  const startDate = getDateOnly(tournament.start_date) || tournament.start_date
  return startDate <= today
}

function hasEventBegun(tournament: Tournament | null) {
  return tournamentHasScoringEvidence(tournament)
}

function isUpcomingEntry(pool: PoolRecord, tournament: Tournament | null) {
  return !pool.is_completed && tournament?.status !== 'completed' && !hasEventBegun(tournament)
}

function picksAreVisible(pool: PoolRecord, tournament: Tournament | null) {
  return picksAreVisibleForPool(pool, tournament)
}

function entryForDashboardBoard(entry: EntryRecord, pool?: PoolRecord | null, revealPicks = false): EntryRecord {
  const tournament = getTournament(pool)
  if (!pool || revealPicks || picksAreVisible(pool, tournament)) return entry
  const picks = Array.isArray(entry.golfer_picks) ? entry.golfer_picks as string[] : []
  return {
    ...entry,
    golfer_picks: [],
    picks_hidden: picks.length > 0,
  }
}

function UpcomingBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`inline-flex justify-center border border-[#b58a3a] bg-[#fff4cf] px-2 py-1 font-black uppercase text-[#7a5a19] ${compact ? 'w-full max-w-[96px] text-[10px] tracking-[0.08em]' : 'min-w-[116px] text-xs tracking-[0.12em]'}`}>
      Upcoming
    </span>
  )
}

function PendingInvites({ invites }: { invites: PendingInviteRecord[] }) {
  if (!invites.length) return null

  return (
    <section className="border-2 border-[#123c2f] bg-white shadow-[7px_7px_0_#d8cab0]">
      <div className="border-b border-[#d8cab0] bg-[#fbf7ed] px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a6724]">Pool invites</p>
        <h2 className="font-display text-2xl font-bold text-[#0f2f25]">You were invited</h2>
      </div>
      <div className="divide-y divide-[#eadfca]">
        {invites.map(invite => {
          const pool = getInvitePool(invite)
          const tournament = getTournament(pool)
          if (!pool) return null
          return (
            <div key={invite.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div>
                <p className="font-display text-xl font-bold text-[#0f2f25]">{pool.name}</p>
                <p className="mt-1 text-sm font-semibold text-[#657168]">{displayTournamentName(tournament?.name) || 'Tournament'} · {formatDate(tournament?.start_date)}</p>
              </div>
              <div className="flex gap-2">
                <form action={acceptPoolInvite}>
                  <input type="hidden" name="inviteId" value={invite.id} />
                  <button className="border-2 border-[#123c2f] bg-[#123c2f] px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-white">Accept</button>
                </form>
                <form action={declinePoolInvite}>
                  <input type="hidden" name="inviteId" value={invite.id} />
                  <button className="border-2 border-[#d8cab0] bg-white px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-[#657168]">Decline</button>
                </form>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function formatScore(score: number | null) {
  if (score === null) return '—'
  if (score === 0) return 'E'
  return score > 0 ? `+${score}` : String(score)
}

function buildScoredEntries(pool: PoolRecord, allEntries: EntryRecord[]): ScoredEntry[] {
  const tournament = getTournament(pool)
  const leaderboard = Array.isArray(tournament?.leaderboard_json) ? tournament.leaderboard_json : []
  const canShowRank = Boolean(pool.is_locked || tournamentHasScoringEvidence({ ...tournament, leaderboard_json: leaderboard }))

  if (pool.is_completed && hasCompleteFrozenResults(allEntries)) {
    return frozenResultsForEntries(allEntries)
  }

  if (!canShowRank || leaderboard.length === 0) return []

  return scoreEntriesForLeaderboard(
    allEntries,
    leaderboard,
    {
      countScores: pool.count_scores || pool.pick_count || 0,
      obRuleEnabled: Boolean(pool.ob_rule_enabled),
      obPenaltyStrokes: pool.ob_penalty_strokes ?? 2,
    }
  )
}

function buildRankPreview(entry: EntryRecord, pool: PoolRecord, allEntries: EntryRecord[]) {
  const scored = buildScoredEntries(pool, allEntries)
  const current = scored.find(scoredEntry => scoredEntry.entryId === entry.id)
  if (!current) return null
  return { rank: current.rank, totalScore: current.totalScore, fieldSize: scored.length }
}

function winnerLabel(pool: PoolRecord, allEntries: EntryRecord[]) {
  const winners = buildScoredEntries(pool, allEntries).filter(entry => entry.rank === 1)
  if (winners.length === 0) return null
  if (winners.length === 1) return winners[0].displayName
  return `${winners[0].displayName} + ${winners.length - 1}`
}

function ResultBadge({ label, value, tone = 'green' }: { label: string; value: string; tone?: 'green' | 'red' | 'gold' }) {
  const toneClass = tone === 'red'
    ? 'border-[#b21e23] bg-[#fff1ef] text-[#b21e23]'
    : tone === 'gold'
      ? 'border-[#b58a3a] bg-[#fff4cf] text-[#7a5a19]'
      : 'border-[#123c2f] bg-white text-[#123c2f]'

  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-1 text-xs font-black uppercase tracking-[0.08em] ${toneClass}`}>
      <span className="text-[#657168]">{label}</span>
      <span>{value}</span>
    </span>
  )
}

function WinnerBadge({ name }: { name?: string | null }) {
  return <ResultBadge label="Winner" value={name || '—'} tone="gold" />
}

function CompactResultBadge({ rank, score }: { rank: string; score: string }) {
  return (
    <span className="inline-flex shrink-0 items-center border border-[#123c2f] bg-white px-2 py-1 font-mono text-xs font-black uppercase tracking-[0.06em] text-[#123c2f] shadow-[2px_2px_0_#d8cab0]">
      {rank} / <span className="ml-1 text-[#b21e23]">{score}</span>
    </span>
  )
}

function WinnerTrophyIcon() {
  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center border-2 border-[#b58a3a] bg-[#fff4cf] text-[#123c2f] shadow-[2px_2px_0_#d8cab0]" aria-label="Pool winner">
      <svg aria-hidden="true" viewBox="0 0 32 32" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" strokeLinejoin="miter">
        <path d="M10 5h12v5c0 5-2.7 8-6 8s-6-3-6-8V5Z" fill="#d8b45d" />
        <path d="M10 8H6v3c0 3 2 5 5 5" />
        <path d="M22 8h4v3c0 3-2 5-5 5" />
        <path d="M16 18v5" />
        <path d="M11 27h10" />
        <path d="M13 23h6l1 4h-8l1-4Z" fill="#d8b45d" />
      </svg>
    </span>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=%2Fdashboard')

  const [ownedPoolsResult, entriesResult, pendingInvitesResult, dismissedFinalResultsResult, upcomingTournamentsResult] = await Promise.all([
    supabase
      .from('gpp_pools')
      .select('id, name, passcode, is_locked, is_completed, payment_status, amount_paid_cents, pick_count, count_scores, ob_rule_enabled, ob_penalty_strokes, game_format, group_count, picks_per_group, pick_groups_json, lock_at, groups_finalized_at, gpp_tournaments(id, name, external_id, start_date, end_date, status, field_json, leaderboard_json, cut_score, last_scores_fetch)')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('gpp_entries')
      .select('id, pool_id, display_name, golfer_picks, counting_scores, total_score, rank, is_removed, gpp_pools(id, name, passcode, is_locked, is_completed, pick_count, count_scores, ob_rule_enabled, ob_penalty_strokes, game_format, group_count, picks_per_group, pick_groups_json, lock_at, groups_finalized_at, gpp_tournaments(id, name, external_id, start_date, end_date, status, field_json, leaderboard_json, cut_score, last_scores_fetch))')
      .eq('user_id', user.id)
      .eq('is_removed', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('gpp_pool_invites')
      .select('id, pool_id, status, gpp_pools(id, name, passcode, is_locked, is_completed, pick_count, count_scores, game_format, group_count, picks_per_group, pick_groups_json, lock_at, groups_finalized_at, gpp_tournaments(id, name, external_id, start_date, end_date, status, field_json, leaderboard_json, cut_score, last_scores_fetch))')
      .eq('invited_user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase
      .from('gpp_final_result_dismissals')
      .select('pool_id')
      .eq('user_id', user.id),
    supabase
      .from('gpp_tournaments')
      .select('id, name, start_date, status')
      .in('status', ['upcoming', 'live'])
      .order('start_date', { ascending: true }),
  ])
  const { data: ownedPools } = ownedPoolsResult
  const { data: entries } = entriesResult
  const { data: pendingInvites } = pendingInvitesResult
  const { data: dismissedFinalResults } = dismissedFinalResultsResult
  const { data: upcomingTournaments } = upcomingTournamentsResult

  const owned = (ownedPools ?? []) as PoolRecord[]
  const joined = (entries ?? []) as EntryRecord[]
  const invites = (pendingInvites ?? []) as PendingInviteRecord[]
  const ownedPoolIds = owned.map(pool => pool.id)
  const joinedPoolIds = Array.from(new Set(joined.map(entry => entry.pool_id).filter(Boolean)))
  const [ownedPoolEntriesResult, joinedPoolEntriesResult] = await Promise.all([
    ownedPoolIds.length
      ? supabase
        .from('gpp_entries')
        .select('id, pool_id, display_name, golfer_picks, counting_scores, total_score, rank, is_removed')
        .in('pool_id', ownedPoolIds)
        .eq('is_removed', false)
      : Promise.resolve({ data: [] }),
    joinedPoolIds.length
      ? supabase
        .from('gpp_entries')
        .select('id, pool_id, display_name, golfer_picks, counting_scores, total_score, rank, is_removed')
        .in('pool_id', joinedPoolIds)
        .eq('is_removed', false)
      : Promise.resolve({ data: [] }),
  ])
  const { data: ownedPoolEntries } = ownedPoolEntriesResult
  const { data: joinedPoolEntries } = joinedPoolEntriesResult
  const rawPoolEntries = Array.from(
    new Map([...((ownedPoolEntries ?? []) as EntryRecord[]), ...((joinedPoolEntries ?? []) as EntryRecord[])].map(entry => [entry.id, entry])).values()
  )
  const poolById = new Map<string, PoolRecord>()
  owned.forEach(pool => poolById.set(pool.id, pool))
  joined.forEach(entry => {
    const pool = getPool(entry)
    if (pool) poolById.set(pool.id, pool)
  })

  const dashboardPools = Array.from(poolById.values())
  const activeTournamentIds = uniqueTournamentIds(dashboardPools, shouldHydrateActiveTournamentJson)
  const completedTournamentIds = uniqueTournamentIds(
    dashboardPools,
    (pool, tournament) => !isActivePool(pool, tournament) && Boolean(pool.is_completed || tournament?.status === 'completed')
  ).filter(id => !activeTournamentIds.includes(id))

  const [activeTournamentJsonResult, completedTournamentJsonResult] = await Promise.all([
    activeTournamentIds.length
      ? supabase
        .from('gpp_tournaments')
        .select('id, field_json, leaderboard_json')
        .in('id', activeTournamentIds)
      : Promise.resolve({ data: [] }),
    completedTournamentIds.length
      ? supabase
        .from('gpp_tournaments')
        .select('id, external_id, leaderboard_json')
        .in('id', completedTournamentIds)
      : Promise.resolve({ data: [] }),
  ])
  const completedTournamentJson = await hydrateFinalLeaderboards((completedTournamentJsonResult.data ?? []) as Partial<Tournament>[])
  const tournamentJsonById = new Map<string, Partial<Tournament>>(
    [
      ...((activeTournamentJsonResult.data ?? []) as Partial<Tournament>[]),
      ...completedTournamentJson,
    ]
      .filter(row => row.id)
      .map(row => [String(row.id), row])
  )
  dashboardPools.forEach(pool => attachTournamentJson(pool, tournamentJsonById))

  const myEntryIds = new Set(joined.map(entry => entry.id))
  const allPoolEntries = rawPoolEntries.map(entry => entryForDashboardBoard(entry, poolById.get(entry.pool_id), myEntryIds.has(entry.id)))
  const entriesByPool = allPoolEntries.reduce<Record<string, EntryRecord[]>>((groups, entry) => {
    groups[entry.pool_id] = groups[entry.pool_id] || []
    groups[entry.pool_id].push(entry)
    return groups
  }, {})
  const myEntryByPool = joined.reduce<Record<string, EntryRecord>>((entriesByPoolId, entry) => {
    entriesByPoolId[entry.pool_id] = entry
    return entriesByPoolId
  }, {})
  const activePoolCards = [
    ...owned
      .filter(pool => isActivePool(pool, getTournament(pool)))
      .map(pool => ({ pool, tournament: getTournament(pool), role: 'Running', entry: myEntryByPool[pool.id] ?? null as EntryRecord | null })),
    ...joined
      .map(entry => ({ entry, pool: getPool(entry) }))
      .filter((item): item is { entry: EntryRecord; pool: PoolRecord } => Boolean(item.pool && isActivePool(item.pool, getTournament(item.pool))))
      .filter(item => !ownedPoolIds.includes(item.pool.id))
      .map(item => ({ pool: item.pool, tournament: getTournament(item.pool), role: 'Playing', entry: item.entry })),
  ].sort((a, b) => {
    const aDate = a.tournament?.start_date || '9999-12-31'
    const bDate = b.tournament?.start_date || '9999-12-31'
    return aDate.localeCompare(bDate)
  })
  const hasAnyPools = owned.length > 0 || joined.length > 0 || invites.length > 0
  const pastEntries = joined.filter(entry => {
    const pool = getPool(entry)
    const tournament = getTournament(pool)
    return Boolean(pool && !isActivePool(pool, tournament))
  }).sort((a, b) => tournamentSortDate(getPool(b)).localeCompare(tournamentSortDate(getPool(a))))
  const dismissedPoolIds = new Set(((dismissedFinalResults ?? []) as any[]).map((row: any) => String(row.pool_id)).filter(Boolean))
  const nextOpenTournament = selectNextRunItBackTournament((upcomingTournaments ?? []) as Tournament[])
  const finalResultCandidates: FinalResultAnnouncementCandidate[] = pastEntries.flatMap(entry => {
    const pool = getPool(entry)
    if (!pool) return []
    const tournament = getTournament(pool)
    if (!pool.is_completed && tournament?.status !== 'completed') return []
    const scoredEntries = buildScoredEntries(pool, entriesByPool[pool.id] || [entry])
    const current = scoredEntries.find(scoredEntry => scoredEntry.entryId === entry.id)
    if (!current?.rank) return []
    return [{
      entryId: entry.id,
      poolId: pool.id,
      poolName: pool.name,
      tournamentName: displayTournamentName(tournament?.name) || 'Tournament',
      isOwner: ownedPoolIds.includes(pool.id),
      runItBackHref: nextOpenTournament?.id ? `/pool/create?clone=${pool.id}&tournament=${nextOpenTournament.id}` : undefined,
      runItBackTournamentName: displayTournamentName(nextOpenTournament?.name) || undefined,
      rank: current.rank,
      totalScore: current.totalScore,
      fieldSize: scoredEntries.length,
      scoredEntries,
    }]
  })
  const finalResultAnnouncement = selectFinalResultAnnouncement(finalResultCandidates, dismissedPoolIds)

  return (
    <div className="space-y-4 sm:space-y-8">
      <FinalResultPopup announcement={finalResultAnnouncement} dismissAction={dismissFinalResultAnnouncement} />
      <section className="hidden border-2 border-[#123c2f] bg-white shadow-[7px_7px_0_#d8cab0] sm:block">
        <div className="flex flex-col gap-4 border-b border-[#d8cab0] bg-[#fbf7ed] p-5 md:flex-row md:items-center md:justify-between md:p-7">
          <h1 className="font-display text-4xl font-bold uppercase tracking-[-0.03em] text-[#0f2f25] md:text-5xl">Player Dashboard</h1>
        </div>
      </section>

      <ClaimedPromoBanner />
      <PendingInvites invites={invites} />
      <DashboardActivePools cards={activePoolCards} entriesByPool={entriesByPool} userId={user.id} />

      {!hasAnyPools ? (
        <section className="border-2 border-[#123c2f] bg-white p-5 shadow-[7px_7px_0_#d8cab0] sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a6724]">Get started</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-[#0f2f25]">What are you here to do?</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link href="/pool/join" className="border-2 border-[#123c2f] bg-[#123c2f] px-5 py-4 font-black text-white transition-colors hover:bg-[#0f2f25]">
              Have a passcode? Join a pool.
            </Link>
            <Link href="/pool/create" className="border-2 border-[#123c2f] bg-[#fbf7ed] px-5 py-4 font-black text-[#123c2f] transition-colors hover:bg-white">
              Running the group? Create a pool.
            </Link>
          </div>
        </section>
      ) : (
        <>
      <section className="md:hidden">
        <Link href="/pool/join" className="gpp-3d gpp-button-3d gpp-button-wrap gpp-button-3d-light w-full text-sm">
          <span className="gpp-button-face w-full px-5 py-3">Join pool</span>
        </Link>
      </section>
      <section className="border border-stone-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-stone-200 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a6724]">Player history</p>
            <h2 className="font-display text-2xl font-bold text-[#0f2f25]">Past Pools</h2>
          </div>
          <Link href="/pool/join" className="hidden border-2 border-[#123c2f] bg-[#123c2f] px-3 py-2 text-sm font-black text-white hover:bg-[#0f2f25] sm:block">Join another</Link>
        </div>

        {!pastEntries.length ? (
          <div className="p-8 text-center">
            <h3 className="font-display text-2xl font-bold text-[#0f2f25]">No past pools yet.</h3>
            <p className="mx-auto mt-3 max-w-md leading-7 text-[#657168]">Completed pools will show up here after tournament week.</p>
            <Link href="/pool/join" className="mt-5 inline-flex border-2 border-[#123c2f] bg-[#123c2f] px-5 py-3 text-sm font-black text-white hover:bg-[#0f2f25]">Join pool</Link>
          </div>
        ) : (
          <div className="grid gap-3 bg-[#fbf7ed] p-4 sm:grid-cols-2 sm:gap-4 sm:p-5">
            {pastEntries.map(entry => {
              const pool = getPool(entry)
              if (!pool) return null
              const tournament = getTournament(pool)
              const picks = Array.isArray(entry.golfer_picks) ? entry.golfer_picks : []
              const isUpcoming = isUpcomingEntry(pool, tournament)
              const rankPreview = buildRankPreview(entry, pool, entriesByPool[pool.id] || [entry])
              const winner = winnerLabel(pool, entriesByPool[pool.id] || [entry])
              const rankText = rankPreview?.rank ? `#${rankPreview.rank}` : '—'
              const scoreText = rankPreview ? formatScore(rankPreview.totalScore) : '—'
              const dateRange = formatDateRange(tournament?.start_date, tournament?.end_date)
              const isWinner = !isUpcoming && rankPreview?.rank === 1

              return (
                <Link key={entry.id} href={`/pool/${pool.id}`} className="group block border-2 border-[#d8cab0] bg-white p-4 text-sm shadow-[4px_4px_0_#eadfca] transition-colors hover:border-[#123c2f] hover:bg-[#fffdf8]">
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="flex min-w-0 items-start gap-2">
                        {isWinner ? <WinnerTrophyIcon /> : null}
                        <span className="min-w-0">
                          <span className="block break-words font-display text-xl font-bold leading-tight text-[#0f2f25]">{pool.name}</span>
                          <span className="mt-1 block text-xs leading-5 text-[#657168]">{entry.display_name || 'Your entry'} · {picks.length ? `${picks.length} picks` : 'Pick team'}</span>
                        </span>
                      </span>
                    </span>
                    {isUpcoming ? <UpcomingBadge compact /> : <CompactResultBadge rank={rankText} score={scoreText} />}
                  </span>
                  <span className="mt-3 block border-t border-[#eadfca] pt-3 text-xs leading-5 text-[#657168]">
                    <span className="font-semibold text-[#1f2a24]">{displayTournamentName(tournament?.name) || 'Tournament'}</span>
                    <span className="mx-1.5 text-[#b58a3a]">/</span>
                    <span className="font-mono">{dateRange}</span>
                  </span>
                  {!isUpcoming ? (
                    <span className="mt-3 flex flex-wrap items-center gap-2">
                      <WinnerBadge name={winner} />
                    </span>
                  ) : null}
                </Link>
              )
            })}
          </div>
        )}
      </section>
        </>
      )}
    </div>
  )
}
