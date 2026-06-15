import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { reserveEmailEvent, finishEmailEvent } from '@/lib/email-events'
import { entryRecipientEmail } from '@/lib/pool-email-recipients'
import { sendMissingPicksReminderEmail } from '@/lib/pool-transactional-emails'

export const runtime = 'nodejs'

type Body = {
  poolId?: unknown
}

function requiredPickCount(pool: any) {
  if (pool?.game_format === 'ranked_groups' || pool?.game_format === 'random_groups') {
    const groups = Array.isArray(pool.pick_groups_json) ? pool.pick_groups_json : []
    const picksPerGroup = Number(pool.picks_per_group || 1)
    if (groups.length > 0 && picksPerGroup > 0) return groups.length * picksPerGroup
    const groupCount = Number(pool.group_count || 0)
    if (groupCount > 0 && picksPerGroup > 0) return groupCount * picksPerGroup
  }
  return Number(pool?.pick_count || 0)
}

function dateKey() {
  return new Date().toISOString().slice(0, 10)
}

export async function POST(request: Request) {
  let body: Body = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const poolId = typeof body.poolId === 'string' ? body.poolId : ''
  if (!poolId) return NextResponse.json({ error: 'Missing pool.' }, { status: 400 })

  const userSupabase = await createClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient() as any
  const { data: pool, error: poolError } = await supabase
    .from('gpp_pools')
    .select('id, name, owner_id, is_locked, is_completed, pick_count, game_format, group_count, picks_per_group, pick_groups_json, gpp_tournaments(name, status, start_date)')
    .eq('id', poolId)
    .maybeSingle()

  if (poolError || !pool) return NextResponse.json({ error: 'Pool not found.' }, { status: 404 })
  if (pool.owner_id !== user.id) return NextResponse.json({ error: 'Only the pool runner can send reminders.' }, { status: 403 })

  const tournament = Array.isArray(pool.gpp_tournaments) ? pool.gpp_tournaments[0] : pool.gpp_tournaments
  const picksClosed = pool.is_locked || pool.is_completed || tournament?.status === 'live' || tournament?.status === 'completed'
  if (picksClosed) return NextResponse.json({ error: 'Picks are closed for this pool.' }, { status: 409 })

  const needed = requiredPickCount(pool)
  if (needed <= 0) return NextResponse.json({ ok: true, sent: 0, skipped: 0, noEmail: 0, duplicate: 0 })

  const { data: entries, error: entriesError } = await supabase
    .from('gpp_entries')
    .select('id, user_id, display_name, notification_email, golfer_picks, is_removed')
    .eq('pool_id', pool.id)
    .eq('is_removed', false)

  if (entriesError) return NextResponse.json({ error: entriesError.message }, { status: 500 })

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
  let sent = 0
  let skipped = 0
  let noEmail = 0
  let duplicate = 0

  for (const entry of entries || []) {
    const pickCount = Array.isArray(entry.golfer_picks) ? entry.golfer_picks.length : 0
    if (pickCount >= needed) continue

    const recipient = await entryRecipientEmail(supabase, entry)
    if (!recipient) {
      noEmail++
      continue
    }

    const dedupeKey = `missing_picks:${pool.id}:${entry.id}:${dateKey()}`
    const event = await reserveEmailEvent(supabase, {
      poolId: pool.id,
      entryId: entry.id,
      emailType: 'missing_picks_reminder',
      dedupeKey,
      recipient,
      payload: { poolName: pool.name, entryName: entry.display_name, pickCount, requiredPickCount: needed },
    })
    if (!event.reserved) {
      duplicate++
      continue
    }

    try {
      const result = await sendMissingPicksReminderEmail({
        supabase,
        origin,
        recipient,
        pool,
        tournament,
        entry,
        pickCount,
        requiredPickCount: needed,
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

  return NextResponse.json({ ok: true, sent, skipped, noEmail, duplicate })
}
