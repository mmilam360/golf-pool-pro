export const runtime = 'edge'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatMoney, getPoolPaymentQuote, getPoolPaymentStatus } from '@/lib/payments/pricing'

type Tournament = {
  name?: string | null
  start_date?: string | null
  status?: string | null
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
  gpp_tournaments?: Tournament | Tournament[] | null
}

type EntryRecord = {
  pool_id: string
  user_id?: string | null
  display_name?: string | null
  golfer_picks?: unknown
}

function getTournament(pool?: PoolRecord | null): Tournament | null {
  const tournament = pool?.gpp_tournaments
  return Array.isArray(tournament) ? tournament[0] ?? null : tournament ?? null
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

function canShowInvitePrep(pool: PoolRecord, tournament: Tournament | null) {
  const eventStarted = tournament?.start_date ? new Date(tournament.start_date).getTime() <= Date.now() : false
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

export default async function ManagePoolsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: ownedPools } = await supabase
    .from('gpp_pools')
    .select('id, name, passcode, pick_count, count_scores, ob_rule_enabled, ob_penalty_strokes, is_locked, is_completed, payment_status, amount_paid_cents, gpp_tournaments(name, start_date, status)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  const owned = (ownedPools ?? []) as PoolRecord[]
  const ownedPoolIds = owned.map(pool => pool.id)
  const { data: ownedPoolEntries } = ownedPoolIds.length
    ? await supabase
      .from('gpp_entries')
      .select('pool_id, user_id, display_name, golfer_picks, is_removed')
      .in('pool_id', ownedPoolIds)
      .eq('is_removed', false)
    : { data: [] }

  const ownedEntryCounts = ((ownedPoolEntries ?? []) as EntryRecord[]).reduce<Record<string, number>>((counts, entry) => {
    counts[entry.pool_id] = (counts[entry.pool_id] || 0) + 1
    return counts
  }, {})

  return (
    <div className="space-y-8">
      <section className="border-2 border-[#123c2f] bg-white shadow-[7px_7px_0_#d8cab0]">
        <div className="flex items-center justify-between gap-3 border-b border-[#d8cab0] bg-[#123c2f] px-4 py-4 text-white sm:px-5">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#d7c99f]">Pool runner board</p>
            <h1 className="font-display text-2xl font-bold uppercase sm:text-3xl">Manage Pools</h1>
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
              const showInvitePrep = canShowInvitePrep(pool, tournament)
              return (
                <div key={pool.id} className={index % 2 === 0 ? 'bg-white' : 'bg-[#fbf7ed]'}>
                  <Link href={`/pool/${pool.id}`} className="grid grid-cols-[minmax(0,1fr)_76px_82px] items-center border-b border-[#eadfca] px-4 py-4 text-sm transition-colors hover:bg-[#f7efdf] sm:grid-cols-[1.3fr_1fr_82px_86px_100px_110px] sm:px-5">
                    <span className="min-w-0 pr-3">
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="truncate font-semibold text-[#1f2a24]">{pool.name}</span>
                        {showInvitePrep ? (
                          <span className="shrink-0 border border-[#b58a3a] bg-[#fff4cf] px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#7a5a19]">Invite</span>
                        ) : null}
                      </span>
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
                  {(pool.is_completed || tournament?.status === 'completed') && (
                    <div className="border-b border-[#eadfca] px-4 pb-3 sm:px-5">
                      <Link href={`/pool/create?clone=${pool.id}`} className="inline-flex border border-[#123c2f] bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] text-[#123c2f] hover:bg-[#eef7ef]">
                        Run it again
                      </Link>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
