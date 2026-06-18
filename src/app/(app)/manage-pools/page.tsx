export const runtime = 'edge'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatDateOnly, hasDateOnlyStarted } from '@/lib/date-utils'
import { getPoolPaymentQuote, getPoolPaymentStatus, formatMoney } from '@/lib/payments/pricing'
import { selectNextRunItBackTournament } from '@/lib/run-it-back'
import { scoreEntriesForLeaderboard, type ScoredEntry } from '@/lib/scoring'
import ClaimedPromoBanner from '@/components/ClaimedPromoBanner'
import RunnerMissingPicksEmailButton from '@/components/RunnerMissingPicksEmailButton'
import { displayTournamentName } from '@/lib/tournament-name'
import { frozenResultsForEntries, hasCompleteFrozenResults } from '@/lib/frozen-results'
import { totalPicksRequired } from '@/lib/pick-counts'
import type { GolfPlayer } from '@/lib/golf-api'
import { hydrateFinalLeaderboard } from '@/lib/fresh-final-leaderboard'

type Tournament = {
  id?: string | null
  name?: string | null
  start_date?: string | null
  end_date?: string | null
  status?: string | null
  leaderboard_json?: GolfPlayer[] | null
  last_scores_fetch?: string | null
}

type PoolRecord = {
  id: string
  name: string
  passcode: string
  pick_count: number
  count_scores: number
  ob_rule_enabled: boolean
  ob_penalty_strokes: number
  is_locked: boolean | null
  is_completed: boolean | null
  payment_status?: string | null
  amount_paid_cents?: number | null
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
  user_id?: string | null
  display_name: string | null
  golfer_picks: unknown
  counting_scores?: unknown
  total_score?: number | null
  rank?: number | null
  is_removed?: boolean | null
}

function getTournament(pool?: PoolRecord | null): Tournament | null {
  const tournament = pool?.gpp_tournaments
  return Array.isArray(tournament) ? tournament[0] ?? null : tournament ?? null
}

function formatDate(value?: string | null) {
  return formatDateOnly(value)
}

function formatShortDate(value?: string | null, includeYear = false) {
  const dateOnly = value ? value.slice(0, 10) : ''
  if (!dateOnly) return 'TBD'
  const [year, month, day] = dateOnly.split('-').map(Number)
  if (!year || !month || !day) return formatDateOnly(value)
  return includeYear ? `${month}/${day}/${String(year).slice(-2)}` : `${month}/${day}`
}

function formatDateRange(start?: string | null, end?: string | null) {
  const startOnly = start ? start.slice(0, 10) : ''
  const endOnly = end ? end.slice(0, 10) : ''
  if (!endOnly || startOnly === endOnly) return formatShortDate(start, true)
  return `${formatShortDate(start)}–${formatShortDate(end, true)}`
}

function formatPoolFormat(pool: PoolRecord) {
  const count = pool.count_scores || 8
  if (pool.game_format === 'ranked_groups') {
    return { name: 'Tiered', detail: `${pool.group_count || 6}×${pool.picks_per_group || 2}, Top ${count} Count` }
  }
  if (pool.game_format === 'random_groups') {
    return { name: 'Chaos', detail: `${pool.group_count || 6}×${pool.picks_per_group || 2}, Top ${count} Count` }
  }
  return { name: 'Open Picks', detail: `${pool.pick_count || 12} Picks, Top ${pool.count_scores || 8} Count` }
}

function feeStatus(pool: PoolRecord, activeEntryCount: number, tournament: Tournament | null) {
  const amountPaidCents = Number(pool.amount_paid_cents || 0)
  const quote = getPoolPaymentQuote(activeEntryCount, amountPaidCents)
  const paymentStatus = getPoolPaymentStatus(pool.payment_status, activeEntryCount, amountPaidCents)
  const paymentReady = Boolean(pool.is_locked || pool.is_completed || tournament?.status === 'live' || tournament?.status === 'completed')

  if (quote.amountDueCents <= 0) return amountPaidCents > 0 ? 'Paid' : 'Free'
  if (!paymentReady && paymentStatus !== 'archived_unpaid') return `Est. ${formatMoney(quote.amountDueCents)}`
  return `Balance ${formatMoney(quote.amountDueCents)}`
}

function lockSummary(pool: PoolRecord, tournament: Tournament | null) {
  if (tournament?.status === 'live') return 'Scoring live'
  if (pool.is_completed || tournament?.status === 'completed') return 'Final'
  if (pool.is_locked) return 'Picks locked'
  if (pool.game_format && pool.game_format !== 'standard' && !pool.groups_finalized_at) return 'Groups open'
  return 'Open for picks'
}

function formatScore(score: number | null) {
  if (score === null) return '—'
  if (score === 0) return 'E'
  return score > 0 ? `+${score}` : String(score)
}

function statusLabel(pool: PoolRecord, tournament: Tournament | null) {
  if (tournament?.status === 'live') return 'Live'
  if (pool.is_completed || tournament?.status === 'completed') return 'Final'
  if (pool.is_locked) return 'Locked'
  return 'Open'
}

function statusClass(label: string) {
  if (label === 'Live') return 'border-[#1f6b4a] bg-[#123c2f] text-white'
  if (label === 'Locked') return 'border-[#b58a3a] bg-[#fbf0c9] text-[#7a5a19]'
  if (label === 'Final') return 'border-[#d8cab0] bg-[#f3ede0] text-[#657168]'
  return 'border-[#cfe0d3] bg-[#eef7ef] text-[#1f6b4a]'
}

function canShowInvitePrep(pool: PoolRecord, tournament: Tournament | null) {
  const eventStarted = hasDateOnlyStarted(tournament?.start_date)
  return !pool.is_locked && !pool.is_completed && !eventStarted && tournament?.status !== 'live' && tournament?.status !== 'completed'
}

function LockGlyph({ locked }: { locked: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="square" strokeLinejoin="miter">
      <rect x="5" y="10" width="14" height="10" />
      {locked ? <path d="M8 10V7a4 4 0 0 1 8 0v3" /> : <path d="M8 10V7a4 4 0 0 1 7.2-2.4" />}
    </svg>
  )
}

function StatusBadge({ label, locked }: { label: string; locked: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-1 text-xs font-bold uppercase tracking-[0.12em] ${statusClass(label)}`}>
      {label === 'Final' ? null : <LockGlyph locked={locked || label === 'Live'} />}
      {label}
    </span>
  )
}

function BalanceBadge({ pool, activeEntryCount, tournament }: { pool: PoolRecord; activeEntryCount: number; tournament: Tournament | null }) {
  const amountPaidCents = Number(pool.amount_paid_cents || 0)
  const quote = getPoolPaymentQuote(activeEntryCount, amountPaidCents)
  const paymentStatus = getPoolPaymentStatus(pool.payment_status, activeEntryCount, amountPaidCents)
  const paymentReady = Boolean(pool.is_locked || pool.is_completed || tournament?.status === 'live' || tournament?.status === 'completed')

  if (quote.amountDueCents <= 0) {
    if (amountPaidCents > 0) {
      return <span className="inline-flex justify-center border border-[#b58a3a] bg-[#fff4cf] px-2 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[#7a5a19]">Paid</span>
    }
    return <span className="inline-flex justify-center border border-[#cfe0d3] bg-[#eef7ef] px-2 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[#1f6b4a]">Free</span>
  }

  if (!paymentReady && paymentStatus !== 'archived_unpaid') {
    return <span className="inline-flex justify-center border border-[#d8cab0] bg-[#fbf7ed] px-2 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[#7a5a19]">Current {formatMoney(quote.amountDueCents)}</span>
  }

  const dueDate = tournament?.start_date ? formatDate(tournament.start_date) : null

  return (
    <span className="inline-flex flex-col items-center justify-center border border-[#b21e23] bg-[#fff1ef] px-2 py-1 text-center text-xs font-bold uppercase leading-tight tracking-[0.12em] text-[#b21e23]">
      <span>Due {formatMoney(quote.amountDueCents)}</span>
      {dueDate ? <span className="mt-0.5 font-mono text-[10px] tracking-[0.08em]">{dueDate}</span> : null}
    </span>
  )
}

function buildScoredEntries(pool: PoolRecord, allEntries: EntryRecord[]): ScoredEntry[] {
  const tournament = getTournament(pool)
  const leaderboard = Array.isArray(tournament?.leaderboard_json) ? tournament.leaderboard_json : []
  if (pool.is_completed && hasCompleteFrozenResults(allEntries)) {
    return frozenResultsForEntries(allEntries)
  }
  if (!leaderboard.length) return []

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

function winnerLabel(pool: PoolRecord, allEntries: EntryRecord[]) {
  const winners = buildScoredEntries(pool, allEntries).filter(entry => entry.rank === 1)
  if (winners.length === 0) return null
  if (winners.length === 1) return winners[0].displayName
  return `${winners[0].displayName} + ${winners.length - 1}`
}

function ResultBadge({ label, value, tone = 'green' }: { label: string; value: string; tone?: 'green' | 'red' | 'gold' | 'paper' }) {
  const toneClass = tone === 'red'
    ? 'border-[#b21e23] bg-[#fff1ef] text-[#b21e23]'
    : tone === 'gold'
      ? 'border-[#b58a3a] bg-[#fff4cf] text-[#7a5a19]'
      : tone === 'paper'
        ? 'border-[#d8cab0] bg-[#fbf7ed] text-[#657168]'
        : 'border-[#123c2f] bg-white text-[#123c2f]'

  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-1 text-xs font-black uppercase tracking-[0.08em] ${toneClass}`}>
      <span className="text-[#657168]">{label}</span>
      <span>{value}</span>
    </span>
  )
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#d8cab0] bg-[#fbf7ed] px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#657168]">{label}</p>
      <p className="mt-1 text-sm font-bold leading-tight text-[#123c2f]">{value}</p>
    </div>
  )
}

function FormatStat({ name, detail }: { name: string; detail: string }) {
  return (
    <div className="border border-[#d8cab0] bg-[#fbf7ed] px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#657168]">Format</p>
      <p className="mt-1 text-sm font-bold leading-tight text-[#123c2f]">{name}</p>
      <p className="mt-1 text-xs font-bold leading-tight text-[#1f2a24]">{detail}</p>
    </div>
  )
}

function CurrentPoolCard({ pool, entries }: { pool: PoolRecord; entries: EntryRecord[] }) {
  const tournament = getTournament(pool)
  const tournamentName = displayTournamentName(tournament?.name) || 'Tournament'
  const activeEntryCount = entries.length
  const label = statusLabel(pool, tournament)
  const showInvitePrep = canShowInvitePrep(pool, tournament)
  const format = formatPoolFormat(pool)
  const picksClosed = Boolean(pool.is_locked || pool.is_completed || tournament?.status === 'live' || tournament?.status === 'completed')
  const requiredPickCount = totalPicksRequired(pool)
  const entriesNeedingPicks = picksClosed || requiredPickCount <= 0
    ? []
    : entries.filter(entry => {
      const picks = Array.isArray(entry.golfer_picks) ? entry.golfer_picks : []
      return picks.length < requiredPickCount
    })
  const picksInCount = Math.max(activeEntryCount - entriesNeedingPicks.length, 0)
  const remindersHref = `/pool/${pool.id}?tab=pool-settings#pick-reminders`
  const primaryHref = showInvitePrep ? `/pool/${pool.id}` : `/pool/${pool.id}?tab=leaderboard`
  const primaryLabel = showInvitePrep ? `Open invite board for ${pool.name}` : `Open leaderboard for ${pool.name}`
  const primaryActionLabel = showInvitePrep ? 'Open invite board →' : 'Open leaderboard →'

  return (
    <div className="border-2 border-[#123c2f] bg-white p-4 shadow-[4px_4px_0_#d8cab0] transition-colors hover:bg-[#fffdf8]">
      <Link href={primaryHref} className="block focus:outline-none focus:ring-4 focus:ring-[#f3df9c]" aria-label={primaryLabel}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="break-words text-xl font-black leading-tight text-[#0f2f25]">{pool.name}</h3>
              {showInvitePrep ? (
                <span className="shrink-0 border border-[#b58a3a] bg-[#fff4cf] px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#7a5a19]">Invite</span>
              ) : null}
            </div>
            <p className="mt-1 text-sm font-bold leading-5 text-[#1f2a24]">{tournamentName}</p>
            <p className="mt-0.5 font-mono text-xs text-[#657168]">{formatDateRange(tournament?.start_date, tournament?.end_date)}</p>
          </div>
          <StatusBadge label={label} locked={Boolean(pool.is_locked)} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <QuickStat label="Entrants" value={String(activeEntryCount)} />
          <FormatStat name={format.name} detail={format.detail} />
          <QuickStat label="Picks in" value={`${picksInCount}/${activeEntryCount}`} />
          <QuickStat label="Fee" value={feeStatus(pool, activeEntryCount, tournament)} />
          <QuickStat label="Status" value={lockSummary(pool, tournament)} />
        </div>
      </Link>

      {entriesNeedingPicks.length > 0 ? (
        <div className="mt-3 border-t border-[#eadfca] pt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8a6724]">{entriesNeedingPicks.length} need picks</p>
            <span className="border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-amber-900">Before lock</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <RunnerMissingPicksEmailButton poolId={pool.id} label="Send reminders" />
            <Link href={remindersHref} className="border-2 border-[#123c2f] bg-white px-4 py-2 text-center text-xs font-black uppercase tracking-[0.08em] text-[#123c2f] transition-colors hover:bg-[#eef7ef]">
              Text/copy list
            </Link>
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-col gap-2 border-t border-[#eadfca] pt-3 sm:flex-row sm:justify-end">
        <Link href={primaryHref} className="text-right text-xs font-black uppercase tracking-[0.12em] text-[#123c2f]">
          {primaryActionLabel}
        </Link>
        <Link href={`/pool/${pool.id}?tab=pool-settings`} className="text-right text-xs font-black uppercase tracking-[0.12em] text-[#657168]">
          Pool settings →
        </Link>
      </div>
    </div>
  )
}

function PoolCard({ pool, entries, nextOpenTournament }: { pool: PoolRecord; entries: EntryRecord[]; nextOpenTournament: Tournament | null }) {
  const tournament = getTournament(pool)
  const tournamentName = displayTournamentName(tournament?.name) || 'Tournament'
  const label = statusLabel(pool, tournament)
  const activeEntryCount = entries.length
  const showInvitePrep = canShowInvitePrep(pool, tournament)
  const isCompleted = Boolean(pool.is_completed || tournament?.status === 'completed')
  const winner = isCompleted ? winnerLabel(pool, entries) : null
  const scoredEntries = isCompleted ? buildScoredEntries(pool, entries) : []
  const winningScore = scoredEntries.find(entry => entry.rank === 1)?.totalScore ?? null

  return (
    <div className="border-2 border-[#d8cab0] bg-white p-4 shadow-[4px_4px_0_#eadfca]">
      <Link href={`/pool/${pool.id}`} className="block transition-colors hover:bg-[#fffdf8]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="break-words font-display text-xl font-bold leading-tight text-[#0f2f25]">{pool.name}</h3>
              {showInvitePrep ? (
                <span className="shrink-0 border border-[#b58a3a] bg-[#fff4cf] px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#7a5a19]">Invite</span>
              ) : null}
            </div>
            <p className="mt-1 text-xs leading-5 text-[#657168]">
              <span className="font-semibold text-[#1f2a24]">{tournamentName}</span>
              <span className="mx-1.5 text-[#b58a3a]">/</span>
              <span className="font-mono">{formatDateRange(tournament?.start_date, tournament?.end_date)}</span>
            </p>
          </div>
          <StatusBadge label={label} locked={Boolean(pool.is_locked)} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 border-t border-[#eadfca] pt-3">
          <ResultBadge label="Entries" value={String(activeEntryCount)} />
          {isCompleted && winner ? <ResultBadge label="Winner" value={winner} tone="gold" /> : null}
          {isCompleted && winningScore !== null ? <ResultBadge label="Winning score" value={formatScore(winningScore)} tone={winningScore < 0 ? 'red' : 'green'} /> : null}
          <BalanceBadge pool={pool} activeEntryCount={activeEntryCount} tournament={tournament} />
        </div>
      </Link>
      {isCompleted && nextOpenTournament?.id && nextOpenTournament.name ? (
        <Link href={`/pool/create?clone=${pool.id}&tournament=${nextOpenTournament.id}`} className="mt-3 flex w-full flex-col items-center justify-center border border-[#123c2f] bg-[#fbf7ed] px-3 py-2.5 text-center text-[#123c2f] transition-colors hover:bg-[#eef7ef]">
          <span className="text-[11px] font-black uppercase tracking-[0.12em]">Copy settings for</span>
          <span className="mt-0.5 text-sm font-bold leading-tight">{displayTournamentName(nextOpenTournament.name) || nextOpenTournament.name}</span>
        </Link>
      ) : null}
    </div>
  )
}

export default async function ManagePoolsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: ownedPools } = await supabase
    .from('gpp_pools')
    .select('id, name, passcode, pick_count, count_scores, ob_rule_enabled, ob_penalty_strokes, is_locked, is_completed, payment_status, amount_paid_cents, game_format, group_count, picks_per_group, pick_groups_json, lock_at, groups_finalized_at, gpp_tournaments(name, external_id, start_date, end_date, status, leaderboard_json, last_scores_fetch)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  const { data: upcomingTournaments } = await supabase
    .from('gpp_tournaments')
    .select('id, name, start_date, status')
    .in('status', ['upcoming', 'live'])
    .order('start_date', { ascending: true })

  const owned = (ownedPools ?? []) as PoolRecord[]
  await Promise.all(owned.map(async pool => {
    const tournament = getTournament(pool)
    if (!tournament) return
    const freshTournament = await hydrateFinalLeaderboard(tournament)
    if (freshTournament) Object.assign(tournament, freshTournament)
  }))
  const nextOpenTournament = selectNextRunItBackTournament((upcomingTournaments ?? []) as Tournament[])
  const ownedPoolIds = owned.map(pool => pool.id)
  const { data: ownedPoolEntries } = ownedPoolIds.length
    ? await supabase
      .from('gpp_entries')
      .select('id, pool_id, user_id, display_name, golfer_picks, counting_scores, total_score, rank, is_removed')
      .in('pool_id', ownedPoolIds)
      .eq('is_removed', false)
    : { data: [] }

  const entriesByPool = ((ownedPoolEntries ?? []) as EntryRecord[]).reduce<Record<string, EntryRecord[]>>((groups, entry) => {
    groups[entry.pool_id] = groups[entry.pool_id] || []
    groups[entry.pool_id].push(entry)
    return groups
  }, {})
  const currentPools = owned.filter(pool => {
    const tournament = getTournament(pool)
    return !pool.is_completed && tournament?.status !== 'completed'
  })
  const finalPools = owned.filter(pool => {
    const tournament = getTournament(pool)
    return Boolean(pool.is_completed || tournament?.status === 'completed')
  }).sort((a, b) => String(getTournament(b)?.start_date || getTournament(b)?.end_date || '').localeCompare(String(getTournament(a)?.start_date || getTournament(a)?.end_date || '')))

  return (
    <div className="space-y-8">
      <ClaimedPromoBanner />
      <section className="border-2 border-[#123c2f] bg-white shadow-[7px_7px_0_#d8cab0]">
        <div className="flex items-center justify-between gap-3 border-b border-[#d8cab0] bg-[#123c2f] px-4 py-4 text-white sm:px-5">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#d7c99f]">Pool runner board</p>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Manage pools</h1>
          </div>
          <Link href="/pool/create" className="shrink-0 border border-[#d8cab0] bg-[#f3df9c] px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#0f2f25] sm:text-sm">Create pool</Link>
        </div>

        {!owned.length ? (
          <div className="scorecard-paper p-8 text-center">
            <h2 className="font-display text-2xl font-bold text-[#0f2f25]">No pools on your board yet.</h2>
            <p className="mx-auto mt-3 max-w-md leading-7 text-[#657168]">Start with one tournament and a passcode. The board fills in when your group joins.</p>
            <Link href="/pool/create" className="gpp-3d gpp-button-3d gpp-button-wrap mt-5 text-sm"><span className="gpp-button-face px-5 py-3">Create pool</span></Link>
          </div>
        ) : (
          <div className="space-y-6 bg-[#fbf7ed] p-4 sm:p-5">
            {currentPools.length ? (
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="font-display text-xl font-bold text-[#0f2f25]">Current pools</h2>
                  <span className="border border-[#d8cab0] bg-white px-2 py-1 text-xs font-black uppercase tracking-[0.1em] text-[#657168]">{currentPools.length}</span>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {currentPools.map(pool => (
                    <CurrentPoolCard key={pool.id} pool={pool} entries={entriesByPool[pool.id] || []} />
                  ))}
                </div>
              </div>
            ) : null}
            {finalPools.length ? (
              <div>
                <div className="mb-3 flex items-center justify-between gap-3 border-t border-[#d8cab0] pt-5">
                  <h2 className="font-display text-xl font-bold text-[#0f2f25]">Final pools</h2>
                  <span className="border border-[#d8cab0] bg-white px-2 py-1 text-xs font-black uppercase tracking-[0.1em] text-[#657168]">{finalPools.length}</span>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {finalPools.map(pool => (
                    <PoolCard key={pool.id} pool={pool} entries={entriesByPool[pool.id] || []} nextOpenTournament={nextOpenTournament ?? null} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  )
}
