import { createServiceClient } from '@/lib/supabase/service'
import { runCronRoute } from '@/lib/cron-run-log'
import { finishEmailEvent, reserveEmailEvent } from '@/lib/email-events'
import { formatMoney, getPoolPaymentQuote, getPoolPaymentStatus, getTournamentSaturday } from '@/lib/payments/pricing'
import { siteOrigin } from '@/lib/pool-email-recipients'
import { sendPaymentDueReminderEmail } from '@/lib/pool-transactional-emails'
import { APP_DATE_TIME_ZONE, todayDateOnly } from '@/lib/date-utils'

export const runtime = 'nodejs'

const EMAIL_TYPE = 'payment_due_runner_reminder'

type TournamentRow = {
  id?: string | null
  name?: string | null
  status?: string | null
  start_date?: string | null
  end_date?: string | null
}

type PoolRow = {
  id: string
  name?: string | null
  owner_id: string
  payment_status?: string | null
  amount_paid_cents?: number | null
  is_locked?: boolean | null
  is_completed?: boolean | null
  gpp_tournaments?: TournamentRow | TournamentRow[] | null
}

function getTournament(pool: PoolRow) {
  const tournament = pool.gpp_tournaments
  return Array.isArray(tournament) ? tournament[0] || null : tournament || null
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function maskEmail(email: string) {
  const [local, domain] = email.split('@')
  if (!local || !domain) return '***'
  return `${local.slice(0, 2)}***@${domain}`
}

async function paymentReminderAlreadySent(supabase: any, poolId: string, recipient: string) {
  const { data, error } = await supabase
    .from('gpp_email_events')
    .select('id')
    .eq('pool_id', poolId)
    .eq('email_type', EMAIL_TYPE)
    .eq('status', 'sent')
    .ilike('recipient', normalizeEmail(recipient))
    .limit(1)

  if (error) throw error
  return Boolean(data?.length)
}

function dueDateOnly(startDate?: string | null) {
  const dueDate = getTournamentSaturday(startDate)
  return dueDate ? dueDate.toISOString().slice(0, 10) : null
}

function dueDateLabel(startDate?: string | null) {
  const dueDate = getTournamentSaturday(startDate)
  if (!dueDate) return 'today'
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(dueDate)
}

function paymentCollectionOpen(pool: PoolRow, tournament: TournamentRow | null) {
  return Boolean(pool.is_locked || tournament?.status === 'live' || tournament?.status === 'completed')
}

async function ownerEmail(supabase: any, ownerId: string) {
  const { data: userResult } = await supabase.auth.admin.getUserById(ownerId)
  const authEmail = userResult?.user?.email || ''
  if (authEmail) return authEmail

  const { data: profile, error } = await supabase
    .from('gpp_profiles')
    .select('email')
    .eq('id', ownerId)
    .maybeSingle()
  if (error) throw error
  return profile?.email || ''
}

async function ownerName(supabase: any, ownerId: string) {
  const { data: profile, error } = await supabase
    .from('gpp_profiles')
    .select('display_name, full_name')
    .eq('id', ownerId)
    .maybeSingle()
  if (error) throw error
  return profile?.full_name || profile?.display_name || null
}

async function activeEntryCount(supabase: any, poolId: string) {
  const { count, error } = await supabase
    .from('gpp_entries')
    .select('id', { count: 'exact', head: true })
    .eq('pool_id', poolId)
    .eq('is_removed', false)
  if (error) throw error
  return count || 0
}

export async function GET(request: Request) {
  return runCronRoute(request, async () => {
    const url = new URL(request.url)
    const dryRun = url.searchParams.get('dry_run') === '1'
    const poolId = url.searchParams.get('pool_id')
    const today = todayDateOnly(APP_DATE_TIME_ZONE)
    const supabase = createServiceClient() as any

    let query = supabase
      .from('gpp_pools')
      .select('id, name, owner_id, payment_status, amount_paid_cents, is_locked, is_completed, gpp_tournaments(id, name, status, start_date, end_date)')
      .in('payment_status', ['draft', 'active', 'payment_due'])
      .eq('is_completed', false)

    if (poolId) query = query.eq('id', poolId)

    const { data: pools, error } = await query
    if (error) throw error

    const candidates: any[] = []
    const sent: any[] = []
    let skipped = 0
    let duplicate = 0
    let failed = 0

    for (const pool of (pools || []) as PoolRow[]) {
      const tournament = getTournament(pool)
      const dueOnly = dueDateOnly(tournament?.start_date)
      if (!dueOnly || dueOnly > today || !paymentCollectionOpen(pool, tournament)) {
        skipped += 1
        continue
      }

      const entryCount = await activeEntryCount(supabase, pool.id)
      const amountPaidCents = Number(pool.amount_paid_cents || 0)
      const quote = getPoolPaymentQuote(entryCount, amountPaidCents)
      const paymentStatus = getPoolPaymentStatus(pool.payment_status, entryCount, amountPaidCents)
      if (paymentStatus !== 'payment_due' || quote.amountDueCents <= 0) {
        skipped += 1
        continue
      }

      const recipient = await ownerEmail(supabase, pool.owner_id)
      const runnerName = await ownerName(supabase, pool.owner_id)
      if (!recipient) {
        skipped += 1
        candidates.push({ poolId: pool.id, poolName: pool.name, skippedReason: 'missing_owner_email' })
        continue
      }

      const normalizedRecipient = normalizeEmail(recipient)
      const payload = {
        poolId: pool.id,
        poolName: pool.name || 'Pool',
        recipient: maskEmail(normalizedRecipient),
        tournamentName: tournament?.name || 'Tournament',
        activeEntryCount: entryCount,
        amountDue: formatMoney(quote.amountDueCents),
        dueDate: dueDateLabel(tournament?.start_date),
        settingsUrl: `${siteOrigin()}/pool/${pool.id}?tab=pool-settings`,
      }
      candidates.push(payload)

      if (dryRun) continue

      if (await paymentReminderAlreadySent(supabase, pool.id, normalizedRecipient)) {
        duplicate += 1
        continue
      }

      const dedupeKey = `${EMAIL_TYPE}:${pool.id}:${normalizedRecipient}`
      const reservation = await reserveEmailEvent(supabase, {
        poolId: pool.id,
        emailType: EMAIL_TYPE,
        dedupeKey,
        recipient: normalizedRecipient,
        payload: {
          poolName: pool.name,
          tournamentName: tournament?.name,
          activeEntryCount: entryCount,
          amountDueCents: quote.amountDueCents,
          dueDate: dueOnly,
        },
      })

      if (!reservation.reserved) {
        duplicate += 1
        continue
      }

      try {
        const result = await sendPaymentDueReminderEmail({
          origin: siteOrigin(),
          recipient: normalizedRecipient,
          poolId: pool.id,
          poolName: pool.name || 'Pool',
          tournamentName: tournament?.name || 'Tournament',
          runnerName,
          activeEntryCount: entryCount,
          amountDueLabel: formatMoney(quote.amountDueCents),
          dueDateLabel: dueDateLabel(tournament?.start_date),
        })

        if ((result as any).sent) {
          await finishEmailEvent(supabase, reservation.id, 'sent')
          sent.push({ poolId: pool.id, poolName: pool.name, recipient: maskEmail(normalizedRecipient), subject: result.subject })
        } else if ((result as any).skipped) {
          await finishEmailEvent(supabase, reservation.id, 'skipped', 'missing_email_provider_key')
          skipped += 1
        } else {
          await finishEmailEvent(supabase, reservation.id, 'failed', `send_failed_${(result as any).status || 'unknown'}`)
          failed += 1
        }
      } catch (sendError: any) {
        await finishEmailEvent(supabase, reservation.id, 'failed', sendError?.message || 'send_failed')
        failed += 1
      }
    }

    return {
      ok: failed === 0,
      dryRun,
      candidates: dryRun ? candidates : candidates.length,
      sent,
      duplicate,
      skipped,
      failed,
    }
  })
}
