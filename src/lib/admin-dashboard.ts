import { getPoolPaymentQuote, getPoolPaymentStatus } from './payments/pricing'

type ServiceClient = ReturnType<typeof import('./supabase/service').createServiceClient>

type PoolRow = {
  id: string
  name: string | null
  passcode: string | null
  owner_id: string | null
  tournament_id: string | null
  created_at: string | null
  updated_at?: string | null
  is_locked: boolean | null
  is_completed: boolean | null
  payment_status: string | null
  paid_entry_limit: number | null
  amount_paid_cents: number | null
  last_payment_at: string | null
  game_format: string | null
}

type EntryRow = {
  id: string
  pool_id: string | null
  golfer_picks: unknown
  is_removed: boolean | null
  created_at: string | null
  updated_at: string | null
}

type TournamentRow = {
  id: string
  name: string | null
  start_date: string | null
  end_date: string | null
  status: string | null
}

type ProfileRow = {
  id: string
  display_name: string | null
  full_name: string | null
  email: string | null
}

export type AdminStat = {
  label: string
  value: string
  note?: string
}

export type AdminPoolRow = {
  id: string
  name: string
  passcode: string
  runnerName: string
  runnerEmail: string
  tournamentName: string
  tournamentStart: string
  status: string
  paymentStatus: string
  paymentNote: string
  amountPaidCents: number
  amountDueCents: number
  activeEntries: number
  activeWithPicks: number
  activeNoPicks: number
  removedEntries: number
  totalEntries: number
  createdAt: string
  lastEntryAt: string
  gameFormat: string
}

export type AdminTournamentRow = {
  id: string
  name: string
  startDate: string
  status: string
  pools: number
  activeEntries: number
  activeWithPicks: number
  removedEntries: number
  amountPaidCents: number
  amountDueCents: number
}

export type AdminRunnerRow = {
  id: string
  name: string
  email: string
  pools: number
  activeEntries: number
  activeWithPicks: number
  amountPaidCents: number
  amountDueCents: number
  latestPoolName: string
  latestPoolAt: string
}

export type AdminDashboardData = {
  stats: AdminStat[]
  pools: AdminPoolRow[]
  tournaments: AdminTournamentRow[]
  runners: AdminRunnerRow[]
}

const PAGE_SIZE = 1000

async function fetchAllRows<T>(client: ServiceClient, table: string, select: string, order?: { column: string; ascending?: boolean }) {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = (client as any).from(table).select(select)
    if (order) query = query.order(order.column, { ascending: order.ascending ?? true })
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`${table} admin query failed: ${error.message}`)
    const page = (data || []) as T[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return rows
}

function countPicks(value: unknown) {
  return Array.isArray(value) ? value.length : 0
}

function moneyLabel(cents: number) {
  const dollars = cents / 100
  return Number.isInteger(dollars) ? `$${dollars.toFixed(0)}` : `$${dollars.toFixed(2)}`
}

function shortDate(value?: string | null) {
  if (!value) return 'TBD'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)
}

function shortDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(date)
}

function titleizeStatus(value?: string | null) {
  if (!value) return 'Unknown'
  return value
    .split('_')
    .map(part => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
    .join(' ')
}

function poolStatus(pool: PoolRow, tournament?: TournamentRow) {
  const tournamentStatus = String(tournament?.status || '').toLowerCase()
  if (pool.is_completed || tournamentStatus === 'completed') return 'Final'
  if (tournamentStatus === 'live') return 'Live'
  if (pool.is_locked) return 'Locked'
  return 'Open'
}

function runnerLabel(profile: ProfileRow | undefined, ownerId?: string | null) {
  const name = profile?.full_name?.trim() || profile?.display_name?.trim() || profile?.email?.trim() || 'Unknown runner'
  const email = profile?.email?.trim() || '—'
  return {
    name,
    email,
    id: ownerId || profile?.id || 'unknown',
  }
}

function latestDate(...values: (string | null | undefined)[]) {
  return values.filter(Boolean).sort().at(-1) || ''
}

function addMoney<T extends { amountPaidCents: number; amountDueCents: number }>(target: T, pool: AdminPoolRow) {
  target.amountPaidCents += pool.amountPaidCents
  target.amountDueCents += pool.amountDueCents
}

export async function getAdminDashboardData(client: ServiceClient): Promise<AdminDashboardData> {
  const [pools, entries, tournaments, profiles] = await Promise.all([
    fetchAllRows<PoolRow>(
      client,
      'gpp_pools',
      'id,name,passcode,owner_id,tournament_id,created_at,updated_at,is_locked,is_completed,payment_status,paid_entry_limit,amount_paid_cents,last_payment_at,game_format',
      { column: 'created_at', ascending: false }
    ),
    fetchAllRows<EntryRow>(client, 'gpp_entries', 'id,pool_id,golfer_picks,is_removed,created_at,updated_at'),
    fetchAllRows<TournamentRow>(client, 'gpp_tournaments', 'id,name,start_date,end_date,status'),
    fetchAllRows<ProfileRow>(client, 'gpp_profiles', 'id,display_name,full_name,email'),
  ])

  const tournamentsById = new Map(tournaments.map(tournament => [tournament.id, tournament]))
  const profilesById = new Map(profiles.map(profile => [profile.id, profile]))
  const entriesByPool = entries.reduce<Record<string, EntryRow[]>>((groups, entry) => {
    if (!entry.pool_id) return groups
    groups[entry.pool_id] = groups[entry.pool_id] || []
    groups[entry.pool_id].push(entry)
    return groups
  }, {})

  const poolRows = pools.map(pool => {
    const poolEntries = entriesByPool[pool.id] || []
    const activeEntries = poolEntries.filter(entry => !entry.is_removed)
    const activeWithPicks = activeEntries.filter(entry => countPicks(entry.golfer_picks) > 0)
    const activeNoPicks = activeEntries.length - activeWithPicks.length
    const removedEntries = poolEntries.length - activeEntries.length
    const tournament = pool.tournament_id ? tournamentsById.get(pool.tournament_id) : undefined
    const runner = runnerLabel(pool.owner_id ? profilesById.get(pool.owner_id) : undefined, pool.owner_id)
    const amountPaidCents = Number(pool.amount_paid_cents || 0)
    const quote = getPoolPaymentQuote(activeEntries.length, amountPaidCents)
    const paymentStatus = getPoolPaymentStatus(pool.payment_status, activeEntries.length, amountPaidCents)
    const paymentNote = quote.amountDueCents > 0 ? `${moneyLabel(quote.amountDueCents)} due` : amountPaidCents > 0 ? `${moneyLabel(amountPaidCents)} covered` : 'No charge now'

    return {
      id: pool.id,
      name: pool.name || 'Untitled pool',
      passcode: pool.passcode || '—',
      runnerName: runner.name,
      runnerEmail: runner.email,
      tournamentName: tournament?.name || 'Unknown tournament',
      tournamentStart: shortDate(tournament?.start_date),
      status: poolStatus(pool, tournament),
      paymentStatus: titleizeStatus(paymentStatus),
      paymentNote,
      amountPaidCents,
      amountDueCents: quote.amountDueCents,
      activeEntries: activeEntries.length,
      activeWithPicks: activeWithPicks.length,
      activeNoPicks,
      removedEntries,
      totalEntries: poolEntries.length,
      createdAt: shortDateTime(pool.created_at),
      lastEntryAt: shortDateTime(latestDate(...poolEntries.map(entry => entry.created_at), ...poolEntries.map(entry => entry.updated_at))),
      gameFormat: titleizeStatus(pool.game_format || 'standard'),
    } satisfies AdminPoolRow
  })

  const tournamentRowsById = new Map<string, AdminTournamentRow>()
  for (const tournament of tournaments) {
    tournamentRowsById.set(tournament.id, {
      id: tournament.id,
      name: tournament.name || 'Unknown tournament',
      startDate: shortDate(tournament.start_date),
      status: titleizeStatus(tournament.status),
      pools: 0,
      activeEntries: 0,
      activeWithPicks: 0,
      removedEntries: 0,
      amountPaidCents: 0,
      amountDueCents: 0,
    })
  }

  const runnerRowsById = new Map<string, AdminRunnerRow>()
  for (const pool of poolRows) {
    const rawPool = pools.find(item => item.id === pool.id)
    const tournament = rawPool?.tournament_id ? tournamentRowsById.get(rawPool.tournament_id) : undefined
    if (tournament) {
      tournament.pools += 1
      tournament.activeEntries += pool.activeEntries
      tournament.activeWithPicks += pool.activeWithPicks
      tournament.removedEntries += pool.removedEntries
      addMoney(tournament, pool)
    }

    const runnerId = rawPool?.owner_id || pool.runnerEmail || pool.runnerName
    const existingRunner = runnerRowsById.get(runnerId) || {
      id: runnerId,
      name: pool.runnerName,
      email: pool.runnerEmail,
      pools: 0,
      activeEntries: 0,
      activeWithPicks: 0,
      amountPaidCents: 0,
      amountDueCents: 0,
      latestPoolName: pool.name,
      latestPoolAt: rawPool?.created_at || '',
    }
    existingRunner.pools += 1
    existingRunner.activeEntries += pool.activeEntries
    existingRunner.activeWithPicks += pool.activeWithPicks
    addMoney(existingRunner, pool)
    if ((rawPool?.created_at || '') > existingRunner.latestPoolAt) {
      existingRunner.latestPoolName = pool.name
      existingRunner.latestPoolAt = rawPool?.created_at || ''
    }
    runnerRowsById.set(runnerId, existingRunner)
  }

  const totalAmountPaidCents = poolRows.reduce((sum, pool) => sum + pool.amountPaidCents, 0)
  const totalAmountDueCents = poolRows.reduce((sum, pool) => sum + pool.amountDueCents, 0)
  const activeEntries = poolRows.reduce((sum, pool) => sum + pool.activeEntries, 0)
  const activeWithPicks = poolRows.reduce((sum, pool) => sum + pool.activeWithPicks, 0)
  const activePools = poolRows.filter(pool => pool.status !== 'Final').length

  return {
    stats: [
      { label: 'Pools', value: String(poolRows.length), note: `${activePools} active` },
      { label: 'Entries', value: String(activeEntries), note: `${activeWithPicks} with picks` },
      { label: 'Runners', value: String(runnerRowsById.size), note: 'Unique pool owners' },
      { label: 'Collected', value: moneyLabel(totalAmountPaidCents), note: totalAmountDueCents > 0 ? `${moneyLabel(totalAmountDueCents)} open` : 'No open balance' },
    ],
    pools: poolRows.sort((a, b) => b.activeEntries - a.activeEntries || b.totalEntries - a.totalEntries || a.name.localeCompare(b.name)),
    tournaments: Array.from(tournamentRowsById.values())
      .filter(tournament => tournament.pools > 0)
      .sort((a, b) => b.activeEntries - a.activeEntries || a.name.localeCompare(b.name)),
    runners: Array.from(runnerRowsById.values())
      .map(runner => ({ ...runner, latestPoolAt: shortDateTime(runner.latestPoolAt) }))
      .sort((a, b) => b.activeEntries - a.activeEntries || b.pools - a.pools || a.name.localeCompare(b.name)),
  }
}

export function formatAdminMoney(cents: number) {
  return moneyLabel(cents)
}
