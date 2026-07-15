import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isGppAdminUser } from '@/lib/admin-access'
import { formatAdminMoney, getAdminDashboardData, type AdminPoolRow, type AdminRunnerRow, type AdminTournamentRow } from '@/lib/admin-dashboard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type BadgeTone = 'green' | 'gold' | 'red' | 'paper'

function badgeClass(tone: BadgeTone) {
  if (tone === 'red') return 'border-[#b21e23] bg-[#fff1ef] text-[#b21e23]'
  if (tone === 'gold') return 'border-[#b58a3a] bg-[#fff4cf] text-[#7a5a19]'
  if (tone === 'paper') return 'border-[#d8cab0] bg-[#fbf7ed] text-[#657168]'
  return 'border-[#1f6b4a] bg-[#eef7ef] text-[#1f6b4a]'
}

function statusTone(status: string): BadgeTone {
  if (status === 'Live') return 'green'
  if (status === 'Locked') return 'gold'
  if (status === 'Final') return 'paper'
  return 'green'
}

function paymentTone(status: string, amountDueCents: number): BadgeTone {
  if (amountDueCents > 0) return 'red'
  if (status === 'Refunded') return 'paper'
  return 'green'
}

function Badge({ children, tone = 'paper' }: { children: React.ReactNode; tone?: BadgeTone }) {
  return <span className={`inline-flex whitespace-nowrap border px-2 py-1 text-[11px] font-bold uppercase tracking-[0.1em] ${badgeClass(tone)}`}>{children}</span>
}

function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="border-2 border-[#123c2f] bg-white p-4 shadow-[4px_4px_0_#d8cab0]">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a6724]">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold text-[#0f2f25]">{value}</p>
      {note ? <p className="mt-1 text-sm font-semibold text-[#657168]">{note}</p> : null}
    </div>
  )
}

function TableShell({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="border-2 border-[#123c2f] bg-white shadow-[7px_7px_0_#d8cab0]">
      <div className="flex items-center justify-between gap-3 border-b border-[#d8cab0] bg-[#fbf7ed] px-4 py-3 sm:px-5">
        <h2 className="font-display text-xl font-bold uppercase text-[#0f2f25]">{title}</h2>
        {typeof count === 'number' ? <span className="border border-[#d8cab0] bg-white px-2 py-1 text-xs font-bold uppercase tracking-[0.1em] text-[#657168]">{count}</span> : null}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  )
}

function TournamentTable({ rows }: { rows: AdminTournamentRow[] }) {
  return (
    <TableShell title="Tournament rollup" count={rows.length}>
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-[#123c2f] text-left text-xs uppercase tracking-[0.12em] text-white">
          <tr>
            <th className="px-4 py-3 font-bold">Tournament</th>
            <th className="px-4 py-3 font-bold">Start</th>
            <th className="px-4 py-3 text-right font-bold">Pools</th>
            <th className="px-4 py-3 text-right font-bold">Entries</th>
            <th className="px-4 py-3 text-right font-bold">With picks</th>
            <th className="px-4 py-3 text-right font-bold">Removed</th>
            <th className="px-4 py-3 text-right font-bold">Collected</th>
            <th className="px-4 py-3 text-right font-bold">Open</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eadfca]">
          {rows.map(row => (
            <tr key={row.id} className="bg-white odd:bg-[#fffdf8]">
              <td className="px-4 py-3 font-bold text-[#0f2f25]">{row.name}</td>
              <td className="px-4 py-3 font-mono text-xs text-[#657168]">{row.startDate}</td>
              <td className="px-4 py-3 text-right font-mono font-bold">{row.pools}</td>
              <td className="px-4 py-3 text-right font-mono font-bold">{row.activeEntries}</td>
              <td className="px-4 py-3 text-right font-mono font-bold text-[#1f6b4a]">{row.activeWithPicks}</td>
              <td className="px-4 py-3 text-right font-mono text-[#657168]">{row.removedEntries}</td>
              <td className="px-4 py-3 text-right font-mono font-bold">{formatAdminMoney(row.amountPaidCents)}</td>
              <td className="px-4 py-3 text-right font-mono font-bold text-[#b21e23]">{formatAdminMoney(row.amountDueCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  )
}

function RunnerTable({ rows }: { rows: AdminRunnerRow[] }) {
  return (
    <TableShell title="Pool runners" count={rows.length}>
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-[#123c2f] text-left text-xs uppercase tracking-[0.12em] text-white">
          <tr>
            <th className="px-4 py-3 font-bold">Runner</th>
            <th className="px-4 py-3 font-bold">Latest pool</th>
            <th className="px-4 py-3 text-right font-bold">Pools</th>
            <th className="px-4 py-3 text-right font-bold">Entries</th>
            <th className="px-4 py-3 text-right font-bold">With picks</th>
            <th className="px-4 py-3 text-right font-bold">Collected</th>
            <th className="px-4 py-3 text-right font-bold">Open</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eadfca]">
          {rows.map(row => (
            <tr key={row.id} className="bg-white odd:bg-[#fffdf8]">
              <td className="px-4 py-3">
                <p className="font-bold text-[#0f2f25]">{row.name}</p>
                <p className="mt-1 font-mono text-xs text-[#657168]">{row.email}</p>
              </td>
              <td className="px-4 py-3">
                <p className="font-semibold text-[#1f2a24]">{row.latestPoolName}</p>
                <p className="mt-1 font-mono text-xs text-[#657168]">{row.latestPoolAt}</p>
              </td>
              <td className="px-4 py-3 text-right font-mono font-bold">{row.pools}</td>
              <td className="px-4 py-3 text-right font-mono font-bold">{row.activeEntries}</td>
              <td className="px-4 py-3 text-right font-mono font-bold text-[#1f6b4a]">{row.activeWithPicks}</td>
              <td className="px-4 py-3 text-right font-mono font-bold">{formatAdminMoney(row.amountPaidCents)}</td>
              <td className="px-4 py-3 text-right font-mono font-bold text-[#b21e23]">{formatAdminMoney(row.amountDueCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  )
}

function PoolTable({ rows }: { rows: AdminPoolRow[] }) {
  return (
    <TableShell title="Pool ledger" count={rows.length}>
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-[#123c2f] text-left text-xs uppercase tracking-[0.12em] text-white">
          <tr>
            <th className="px-4 py-3 font-bold">Pool</th>
            <th className="px-4 py-3 font-bold">Runner</th>
            <th className="px-4 py-3 font-bold">Tournament</th>
            <th className="px-4 py-3 font-bold">Status</th>
            <th className="px-4 py-3 text-right font-bold">Entries</th>
            <th className="px-4 py-3 text-right font-bold">With picks</th>
            <th className="px-4 py-3 text-right font-bold">No picks</th>
            <th className="px-4 py-3 font-bold">Payment</th>
            <th className="px-4 py-3 font-bold">Last entry</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eadfca]">
          {rows.map(row => (
            <tr key={row.id} className="bg-white align-top odd:bg-[#fffdf8]">
              <td className="min-w-[220px] px-4 py-3">
                <Link href={`/pool/${row.id}`} className="font-bold text-[#0f2f25] underline decoration-[#d8cab0] underline-offset-4 hover:text-[#123c2f]">{row.name}</Link>
                <p className="mt-1 font-mono text-xs text-[#657168]">Code {row.passcode} / {row.gameFormat}</p>
              </td>
              <td className="min-w-[190px] px-4 py-3">
                <p className="font-semibold text-[#1f2a24]">{row.runnerName}</p>
                <p className="mt-1 font-mono text-xs text-[#657168]">{row.runnerEmail}</p>
              </td>
              <td className="min-w-[180px] px-4 py-3">
                <p className="font-semibold text-[#1f2a24]">{row.tournamentName}</p>
                <p className="mt-1 font-mono text-xs text-[#657168]">{row.tournamentStart}</p>
              </td>
              <td className="px-4 py-3"><Badge tone={statusTone(row.status)}>{row.status}</Badge></td>
              <td className="px-4 py-3 text-right font-mono font-bold">{row.activeEntries}</td>
              <td className="px-4 py-3 text-right font-mono font-bold text-[#1f6b4a]">{row.activeWithPicks}</td>
              <td className="px-4 py-3 text-right font-mono font-bold text-[#b21e23]">{row.activeNoPicks}</td>
              <td className="min-w-[160px] px-4 py-3">
                <Badge tone={paymentTone(row.paymentStatus, row.amountDueCents)}>{row.paymentStatus}</Badge>
                <p className="mt-1 font-mono text-xs text-[#657168]">{row.paymentNote}</p>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-[#657168]">{row.lastEntryAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  )
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?redirect=/admin')
  if (!isGppAdminUser(user)) redirect('/dashboard')

  const data = await getAdminDashboardData(createServiceClient())

  return (
    <div className="space-y-8">
      <section className="border-2 border-[#123c2f] bg-white shadow-[7px_7px_0_#d8cab0]">
        <div className="border-b border-[#d8cab0] bg-[#123c2f] px-4 py-5 text-white sm:px-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#d7c99f]">Private admin</p>
          <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold uppercase sm:text-4xl">GPP admin board</h1>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#f2ead7]">Pools, runners, tournament totals, entries, and payment status in one place.</p>
            </div>
            <Link href="/dashboard" className="w-fit border border-[#d8cab0] bg-[#f3df9c] px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-[#0f2f25]">Back to dashboard</Link>
          </div>
        </div>
        <div className="grid gap-4 bg-[#fbf7ed] p-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.stats.map(stat => <StatCard key={stat.label} {...stat} />)}
        </div>
      </section>

      <TournamentTable rows={data.tournaments} />
      <RunnerTable rows={data.runners} />
      <PoolTable rows={data.pools} />
    </div>
  )
}
