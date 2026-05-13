export const runtime = 'edge';
import { BoardMetric, ClubhouseBoard } from '@/components/ClubhouseBoard'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

type Tournament = {
  name?: string | null
  start_date?: string | null
  status?: string | null
}

type PoolRecord = {
  id: string
  name: string
  passcode: string
  is_locked: boolean | null
  is_completed: boolean | null
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
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(value))
}

function statusLabel(pool: PoolRecord, tournament: Tournament | null) {
  if (pool.is_completed) return 'Final'
  if (pool.is_locked) return 'Locked'
  if (tournament?.status === 'live') return 'Live'
  return 'Open'
}

function statusClass(label: string) {
  if (label === 'Live') return 'border-[#1f6b4a] bg-[#e7f2ea] text-[#1f6b4a]'
  if (label === 'Locked') return 'border-[#b58a3a] bg-[#fbf0c9] text-[#7a5a19]'
  if (label === 'Final') return 'border-[#d8cab0] bg-[#f3ede0] text-[#657168]'
  return 'border-[#cfe0d3] bg-[#eef7ef] text-[#1f6b4a]'
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: ownedPools } = await supabase
    .from('gpp_pools')
    .select('id, name, passcode, is_locked, is_completed, gpp_tournaments(name, start_date, status)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  const { data: entries } = await supabase
    .from('gpp_entries')
    .select('id, pool_id, display_name, golfer_picks, is_removed, gpp_pools(id, name, passcode, is_locked, is_completed, gpp_tournaments(name, start_date, status))')
    .eq('user_id', user.id)
    .eq('is_removed', false)
    .order('created_at', { ascending: false })

  const owned = (ownedPools ?? []) as PoolRecord[]
  const joined = (entries ?? []) as EntryRecord[]
  const activeCount = owned.filter(pool => !pool.is_completed).length + joined.filter(entry => {
    const pool = getPool(entry)
    return pool && !pool.is_completed
  }).length

  return (
    <div className="space-y-8">
      <section className="border-2 border-[#123c2f] bg-white shadow-[7px_7px_0_#d8cab0]">
        <div className="grid gap-6 border-b border-[#d8cab0] bg-[#fbf7ed] p-5 md:grid-cols-[1fr_auto] md:items-end md:p-7">
          <div>
            <p className="mb-3 w-fit border-y border-[#b58a3a] py-2 text-xs font-bold uppercase tracking-[0.24em] text-[#8a6724]">Clubhouse desk</p>
            <h1 className="font-display text-4xl font-bold tracking-[-0.03em] text-[#0f2f25] md:text-5xl">Dashboard</h1>
            <p className="mt-3 max-w-2xl leading-7 text-[#657168]">Create the next pool, join one by passcode, or jump back into an active board.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/pool/create" className="gpp-3d gpp-button-3d gpp-button-wrap text-sm">
              <span className="gpp-button-face px-5 py-3">Create pool</span>
            </Link>
            <Link href="/pool/join" className="gpp-3d gpp-button-3d gpp-button-wrap gpp-button-3d-light text-sm">
              <span className="gpp-button-face px-5 py-3">Join pool</span>
            </Link>
          </div>
        </div>
        <div className="p-4">
          <ClubhouseBoard title="Desk" label="Clubhouse count" subtitle="Pools on your board">
            <div className="grid grid-cols-3">
              <BoardMetric label="Owned" value={owned.length} tone="green" />
              <BoardMetric label="Joined" value={joined.length} tone="green" />
              <BoardMetric label="Active" value={activeCount} />
            </div>
          </ClubhouseBoard>
        </div>
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
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-[1.2fr_1fr_110px_100px_100px] border-b border-[#d8cab0] bg-[#fbf7ed] px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-[#657168]">
                <span>Pool</span>
                <span>Tournament</span>
                <span>Date</span>
                <span>Status</span>
                <span>Code</span>
              </div>
              {owned.map(pool => {
                const tournament = getTournament(pool)
                const label = statusLabel(pool, tournament)
                return (
                  <Link key={pool.id} href={`/pool/${pool.id}`} className="grid grid-cols-[1.2fr_1fr_110px_100px_100px] items-center border-b border-[#eadfca] px-5 py-4 text-sm transition-colors last:border-b-0 hover:bg-[#fbf7ed]">
                    <span className="font-semibold text-[#1f2a24]">{pool.name}</span>
                    <span className="text-[#657168]">{tournament?.name || 'Tournament'}</span>
                    <span className="font-mono text-[#657168]">{formatDate(tournament?.start_date)}</span>
                    <span><span className={`border px-2 py-1 text-xs font-bold uppercase tracking-[0.12em] ${statusClass(label)}`}>{label}</span></span>
                    <span className="font-mono font-black text-[#123c2f]">{pool.passcode}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </section>

      <section className="border-2 border-[#123c2f] bg-white shadow-[7px_7px_0_#d8cab0]">
        <div className="flex items-center justify-between border-b border-[#d8cab0] bg-[#fbf7ed] px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8a6724]">Player board</p>
            <h2 className="font-display text-2xl font-bold text-[#0f2f25]">Pools you joined</h2>
          </div>
          <Link href="/pool/join" className="hidden border-2 border-[#123c2f] bg-white px-3 py-2 text-sm font-semibold text-[#123c2f] hover:bg-[#f7f0df] sm:block">Join another</Link>
        </div>

        {!joined.length ? (
          <div className="p-8 text-center">
            <h3 className="font-display text-2xl font-bold text-[#0f2f25]">No joined pools yet.</h3>
            <p className="mx-auto mt-3 max-w-md leading-7 text-[#657168]">Enter the passcode from your pool runner when tournament week opens.</p>
            <Link href="/pool/join" className="gpp-3d gpp-button-3d gpp-button-wrap gpp-button-3d-light mt-5 text-sm"><span className="gpp-button-face px-5 py-3">Join pool</span></Link>
          </div>
        ) : (
          <div className="divide-y divide-[#eadfca]">
            {joined.map(entry => {
              const pool = getPool(entry)
              if (!pool) return null
              const tournament = getTournament(pool)
              const picks = Array.isArray(entry.golfer_picks) ? entry.golfer_picks : []
              const label = statusLabel(pool, tournament)
              return (
                <Link key={entry.id} href={`/pool/${pool.id}`} className="grid gap-3 px-5 py-4 transition-colors hover:bg-[#fbf7ed] md:grid-cols-[1.2fr_1fr_120px_120px] md:items-center">
                  <div>
                    <p className="font-semibold text-[#1f2a24]">{pool.name}</p>
                    <p className="mt-1 text-sm text-[#657168]">{entry.display_name || 'Your entry'}</p>
                  </div>
                  <p className="text-sm text-[#657168]">{tournament?.name || 'Tournament'}</p>
                  <p className="font-mono text-sm font-bold text-[#123c2f]">{picks.length ? `${picks.length} picks` : 'Pick team'}</p>
                  <p><span className={`border px-2 py-1 text-xs font-bold uppercase tracking-[0.12em] ${statusClass(label)}`}>{label}</span></p>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
