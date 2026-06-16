import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { reserveEmailEvent, finishEmailEvent } from '@/lib/email-events'
import { requireCronAuth } from '@/lib/cron-auth'
import { sendGuestFullNameReminderEmail } from '@/lib/pool-transactional-emails'

export const runtime = 'nodejs'

type Body = {
  poolId?: unknown
  dryRun?: unknown
  limit?: unknown
}

function needsFullName(entry: any) {
  return !(entry.full_name_confirmed_at && typeof entry.full_name === 'string' && entry.full_name.trim().length > 0)
}

export async function POST(request: Request) {
  const unauthorized = requireCronAuth(request)
  if (unauthorized) return unauthorized

  let body: Body = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const poolId = typeof body.poolId === 'string' ? body.poolId : ''
  const dryRun = body.dryRun !== false
  const limit = typeof body.limit === 'number' && Number.isFinite(body.limit)
    ? Math.max(1, Math.min(200, Math.floor(body.limit)))
    : 200

  if (!poolId) return NextResponse.json({ error: 'Missing pool.' }, { status: 400 })

  const supabase = createServiceClient() as any
  const { data: pool, error: poolError } = await supabase
    .from('gpp_pools')
    .select('id, name, is_completed, gpp_tournaments(name, status, start_date)')
    .eq('id', poolId)
    .maybeSingle()

  if (poolError || !pool) return NextResponse.json({ error: 'Pool not found.' }, { status: 404 })

  const tournament = Array.isArray(pool.gpp_tournaments) ? pool.gpp_tournaments[0] : pool.gpp_tournaments
  if (pool.is_completed || tournament?.status === 'completed') {
    return NextResponse.json({ ok: true, dryRun, candidates: 0, sent: 0, skipped: 0, duplicate: 0, reason: 'pool_completed' })
  }

  const { data: entries, error: entriesError } = await supabase
    .from('gpp_entries')
    .select('id, user_id, display_name, notification_email, full_name, full_name_confirmed_at, is_removed')
    .eq('pool_id', pool.id)
    .eq('is_removed', false)
    .is('user_id', null)
    .not('notification_email', 'is', null)
    .limit(limit)

  if (entriesError) return NextResponse.json({ error: entriesError.message }, { status: 500 })

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
  const targets = (entries || []).filter((entry: any) => entry.notification_email && needsFullName(entry))
  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun,
      candidates: targets.length,
      sent: 0,
      skipped: 0,
      duplicate: 0,
      entries: targets.map((entry: any) => ({ id: entry.id, displayName: entry.display_name || 'Entry', email: entry.notification_email })),
    })
  }

  let sent = 0
  let skipped = 0
  let duplicate = 0

  for (const entry of targets) {
    const recipient = entry.notification_email || ''
    const dedupeKey = `full_name_reminder:${pool.id}:${entry.id}`
    const event = await reserveEmailEvent(supabase, {
      poolId: pool.id,
      entryId: entry.id,
      emailType: 'full_name_reminder',
      dedupeKey,
      recipient,
      payload: { poolName: pool.name, entryName: entry.display_name },
    })
    if (!event.reserved) {
      duplicate++
      continue
    }

    try {
      const result = await sendGuestFullNameReminderEmail({
        supabase,
        origin,
        recipient,
        pool,
        tournament,
        entry,
      })
      if ((result as any)?.sent === false || (result as any)?.skipped) {
        skipped++
        await finishEmailEvent(supabase, event.id, 'skipped', JSON.stringify(result).slice(0, 300))
      } else {
        sent++
        await finishEmailEvent(supabase, event.id, 'sent')
      }
    } catch (error: any) {
      skipped++
      await finishEmailEvent(supabase, event.id, 'failed', error?.message || 'Email failed')
    }
  }

  return NextResponse.json({ ok: true, dryRun, candidates: targets.length, sent, skipped, duplicate })
}
