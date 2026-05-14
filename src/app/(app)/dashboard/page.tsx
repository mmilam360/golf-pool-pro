export const runtime = 'edge';
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import DashboardActivePools from '@/components/DashboardActivePools'
import { formatMoney, getPoolPaymentQuote, getPoolPaymentStatus } from '@/lib/payments/pricing'
import type { GolfPlayer } from '@/lib/golf-api'

type Tournament = {
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
  is_locked: boolean | null
  is_completed: boolean | null
  payment_status?: string | null
  amount_paid_cents?: number | null
  count_scores?: number | null
  ob_rule_enabled?: boolean | null
  ob_penalty_strokes?: number | null
  gpp_tournaments?: Tournament | Tournament[] | null
}

type EntryRecord = {
  id: string
  pool_id: string
  display_name: string | null
  golfer_picks: unknown
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

function formatDate(value?: string | null) {
  if (!value) return 'Date TBA'
  return new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }).format(new Date(value))
}

function statusLabel(pool: PoolRecord, tournament: Tournament | null) {
  if (tournament?.status === 'live') return 'Live'
  if (pool.is_completed || tournament?.status === 'completed') return 'Passed'
  if (pool.is_locked) return 'Locked'
  return 'Open'
}

function statusClass(label: string) {
  if (label === 'Live') return 'border-[#1f6b4a] bg-[#123c2f] text-white'
  if (label === 'Locked') return 'border-[#b58a3a] bg-[#fbf0c9] text-[#7a5a19]'
  if (label === 'Passed') return 'border-[#d8cab0] bg-[#f3ede0] text-[#657168]'
  return 'border-[#cfe0d3] bg-[#eef7ef] text-[#1f6b4a]'
}

function isActivePool(pool: PoolRecord, tournament: Tournament | null) {
  if (pool.is_completed || tournament?.status === 'completed') return false
  if (tournament?.status === 'live') return true
  if (!tournament?.start_date) return true

  const today = new Date().toISOString().slice(0, 10)
  const startDate = tournament.start_date.split('T')[0]
  return startDate >= today
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
      {label === 'Passed' ? null : <LockGlyph locked={locked || label === 'Live'} />}
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
    const label = amountPaidCents > 0 ? 'Paid' : 'Free'
    return <span className="inline-flex justify-center border border-[#cfe0d3] bg-[#eef7ef] px-2 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[#1f6b4a]">{label}</span>
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

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: ownedPools } = await supabase
    .from('gpp_pools')
    .select('id, name, passcode, is_locked, is_completed, payment_status, amount_paid_cents, count_scores, ob_rule_enabled, ob_penalty_strokes, gpp_tournaments(name, start_date, end_date, status, leaderboard_json, last_scores_fetch)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  const { data: entries } = await supabase
    .from('gpp_entries')
    .select('id, pool_id, display_name, golfer_picks, is_removed, gpp_pools(id, name, passcode, is_locked, is_completed, count_scores, ob_rule_enabled, ob_penalty_strokes, gpp_tournaments(name, start_date, end_date, status, leaderboard_json, last_scores_fetch))')
    .eq('user_id', user.id)
    .eq('is_removed', false)
    .order('created_at', { ascending: false })

  const owned = (ownedPools ?? []) as PoolRecord[]
  const joined = (entries ?? []) as EntryRecord[]
  const ownedPoolIds = owned.map(pool => pool.id)
  const { data: ownedPoolEntries } = ownedPoolIds.length
    ? await supabase
      .from('gpp_entries')
      .select('id, pool_id, display_name, golfer_picks, is_removed')
      .in('pool_id', ownedPoolIds)
      .eq('is_removed', false)
    : { data: [] }
  const ownedEntryCounts = ((ownedPoolEntries ?? []) as EntryRecord[]).reduce<Record<string, number>>((counts, entry) => {
    counts[entry.pool_id] = (counts[entry.pool_id] || 0) + 1
    return counts
  }, {})
  const joinedPoolIds = Array.from(new Set(joined.map(entry => entry.pool_id).filter(Boolean)))
  const { data: joinedPoolEntries } = joinedPoolIds.length
    ? await supabase
      .from('gpp_entries')
      .select('id, pool_id, display_name, golfer_picks, is_removed')
      .in('pool_id', joinedPoolIds)
      .eq('is_removed', false)
    : { data: [] }
  const allPoolEntries = Array.from(
    new Map([...((ownedPoolEntries ?? []) as EntryRecord[]), ...((joinedPoolEntries ?? []) as EntryRecord[])].map(entry => [entry.id, entry])).values()
  )
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
  const activeCount = activePoolCards.length

  return (
    <div className="space-y-8">
      <section className="border-2 border-[#123c2f] bg-white shadow-[7px_7px_0_#d8cab0]">
        <div className="border-b border-[#d8cab0] bg-[#fbf7ed] p-5 md:p-7">
          <p className="mb-3 w-fit border-y border-[#b58a3a] py-2 text-xs font-bold uppercase tracking-[0.24em] text-[#8a6724]">Clubhouse desk</p>
          <h1 className="font-display text-4xl font-bold tracking-[-0.03em] text-[#0f2f25] md:text-5xl">Dashboard</h1>
          <p className="mt-3 max-w-2xl leading-7 text-[#657168]">Check active pools, create the next one, or join with a passcode.</p>
        </div>
      </section>

      <DashboardActivePools cards={activePoolCards} entriesByPool={entriesByPool} />

      <section className="flex flex-col gap-3 sm:flex-row">
        <Link href="/pool/create" className="gpp-3d gpp-button-3d gpp-button-wrap text-sm">
          <span className="gpp-button-face px-5 py-3">Create pool</span>
        </Link>
        <Link href="/pool/join" className="gpp-3d gpp-button-3d gpp-button-wrap gpp-button-3d-light text-sm">
          <span className="gpp-button-face px-5 py-3">Join pool</span>
        </Link>
      </section>

      <section className="border-2 border-[#123c2f] bg-white shadow-[7px_7px_0_#d8cab0]">
        <div className="flex items-center justify-between border-b border-[#d8cab0] bg-[#123c2f] px-5 py-4 text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#d7c99f]">Pool runner board</p>
            <h2 className="font-display text-2xl font-bold">Your pools</h2>
          </div>
          <Link href="/pool/create" className="hidden border border-[#d8cab0] bg-[#f3df9c] px-3 py-2 text-sm font-black text-[#0f2f25] sm:block">New pool</Link>
        </div>

        {!owned.length ? (
          <div className="scorecard-paper p-8 text-center">
            <h3 className="font-display text-2xl font-bold text-[#0f2f25]">No pools on your board yet.</h3>
            <p className="mx-auto mt-3 max-w-md leading-7 text-[#657168]">Start with one tournament and a passcode. The board fills in when your group joins.</p>
            <Link href="/pool/create" className="gpp-3d gpp-button-3d gpp-button-wrap mt-5 text-sm"><span className="gpp-button-face px-5 py-3">Create pool</span></Link>
          </div>
        ) : (
          <div className="overflow-hidden">
            <div className="grid grid-cols-[minmax(0,1fr)_76px_82px] border-b border-[#d8cab0] bg-[#fbf7ed] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#657168] sm:grid-cols-[1.3fr_1fr_82px_86px_100px_110px] sm:px-5 sm:text-xs sm:tracking-[0.16em]">
              <span>Pool</span>
              <span className="hidden sm:block">Tournament</span>
              <span className="text-center">Entries</span>
              <span className="text-right sm:text-left">Date</span>
              <span className="hidden sm:block">Status</span>
              <span className="hidden sm:block">Balance</span>
            </div>
            {owned.map((pool, index) => {
              const tournament = getTournament(pool)
              const label = statusLabel(pool, tournament)
              const activeEntryCount = ownedEntryCounts[pool.id] || 0
              return (
                <Link key={pool.id} href={`/pool/${pool.id}`} className={`grid grid-cols-[minmax(0,1fr)_76px_82px] items-center border-b border-[#eadfca] px-4 py-4 text-sm transition-colors last:border-b-0 hover:bg-[#f7efdf] sm:grid-cols-[1.3fr_1fr_82px_86px_100px_110px] sm:px-5 ${index % 2 === 0 ? 'bg-white' : 'bg-[#fbf7ed]'}`}>
                  <span className="min-w-0 pr-3">
                    <span className="block truncate font-semibold text-[#1f2a24]">{pool.name}</span>
                    <span className="mt-1 block text-xs leading-5 text-[#657168] sm:hidden">{tournament?.name || 'Tournament'}</span>
                    <span className="mt-2 flex flex-wrap gap-2 sm:hidden">
                      <StatusBadge label={label} locked={Boolean(pool.is_locked)} />
                      <BalanceBadge pool={pool} activeEntryCount={activeEntryCount} tournament={tournament} />
                    </span>
                  </span>
                  <span className="hidden text-[#657168] sm:block">{tournament?.name || 'Tournament'}</span>
                  <span className="text-center font-black text-[#123c2f]">{activeEntryCount}</span>
                  <span className="text-right font-mono text-[#657168] sm:text-left">{formatDate(tournament?.start_date)}</span>
                  <span className="hidden sm:block"><StatusBadge label={label} locked={Boolean(pool.is_locked)} /></span>
                  <span className="hidden sm:block"><BalanceBadge pool={pool} activeEntryCount={activeEntryCount} tournament={tournament} /></span>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <section className="border border-stone-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-stone-200 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a6724]">Player pools</p>
            <h2 className="font-display text-2xl font-bold text-[#0f2f25]">Pools you joined</h2>
          </div>
          <Link href="/pool/join" className="hidden border-2 border-[#123c2f] bg-[#123c2f] px-3 py-2 text-sm font-black text-white hover:bg-[#0f2f25] sm:block">Join another</Link>
        </div>

        {!joined.length ? (
          <div className="p-8 text-center">
            <h3 className="font-display text-2xl font-bold text-[#0f2f25]">No joined pools yet.</h3>
            <p className="mx-auto mt-3 max-w-md leading-7 text-[#657168]">Enter the passcode from your pool runner when tournament week opens.</p>
            <Link href="/pool/join" className="mt-5 inline-flex border-2 border-[#123c2f] bg-[#123c2f] px-5 py-3 text-sm font-black text-white hover:bg-[#0f2f25]">Join pool</Link>
          </div>
        ) : (
          <div className="overflow-hidden">
            <div className="grid grid-cols-[minmax(0,1fr)_48px_56px_66px] border-b border-stone-200 bg-[#fbf7ed] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#657168] sm:grid-cols-[1.3fr_1fr_66px_76px_86px_104px] sm:px-5 sm:text-xs sm:tracking-[0.16em]">
              <span>Pool</span>
              <span className="hidden sm:block">Tournament</span>
              <span className="text-center">Rank</span>
              <span className="text-center">Score</span>
              <span className="text-right sm:text-left">Date</span>
              <span className="hidden sm:block">Status</span>
            </div>
            {joined.map((entry, index) => {
              const pool = getPool(entry)
              if (!pool) return null
              const tournament = getTournament(pool)
              const picks = Array.isArray(entry.golfer_picks) ? entry.golfer_picks : []
              const label = statusLabel(pool, tournament)
              const rankPreview = buildRankPreview(entry, pool, entriesByPool[pool.id] || [entry])
              const rankText = rankPreview?.rank ? `#${rankPreview.rank}` : '—'
              const scoreText = rankPreview ? formatScore(rankPreview.totalScore) : '—'

              return (
                <Link key={entry.id} href={`/pool/${pool.id}`} className={`grid grid-cols-[minmax(0,1fr)_48px_56px_66px] items-center border-b border-stone-200 px-4 py-4 text-sm transition-colors last:border-b-0 hover:bg-[#f7efdf] sm:grid-cols-[1.3fr_1fr_66px_76px_86px_104px] sm:px-5 ${index % 2 === 0 ? 'bg-white' : 'bg-[#fbf7ed]'}`}>
                  <span className="min-w-0 pr-3">
                    <span className="block truncate font-semibold text-[#1f2a24]">{pool.name}</span>
                    <span className="mt-1 block text-xs leading-5 text-[#657168]">{entry.display_name || 'Your entry'} · {picks.length ? `${picks.length} picks` : 'Pick team'}</span>
                    <span className="mt-1 block text-xs leading-5 text-[#657168] sm:hidden">{tournament?.name || 'Tournament'}</span>
                    <span className="mt-2 inline-flex sm:hidden"><StatusBadge label={label} locked={Boolean(pool.is_locked)} /></span>
                  </span>
                  <span className="hidden text-[#657168] sm:block">{tournament?.name || 'Tournament'}</span>
                  <span className="text-center font-black text-[#123c2f]">{rankText}</span>
                  <span className="text-center font-black text-[#b21e23]">{scoreText}</span>
                  <span className="text-right font-mono text-[#657168] sm:text-left">{formatDate(tournament?.start_date)}</span>
                  <span className="hidden sm:block"><StatusBadge label={label} locked={Boolean(pool.is_locked)} /></span>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <section className="border border-[#d8cab0] bg-[#fbf7ed] px-4 py-3 text-[#0f2f25]">
        <div className="grid grid-cols-3 divide-x divide-[#d8cab0] text-center">
          {[
            { label: 'Owned', value: owned.length },
            { label: 'Joined', value: joined.length },
            { label: 'Active', value: activeCount },
          ].map(item => (
            <div key={item.label} className="px-2">
              <p className="text-lg font-black leading-none">{item.value}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#657168]">{item.label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
