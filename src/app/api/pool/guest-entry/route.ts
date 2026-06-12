import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createGuestEntryToken, hashGuestEntryToken, normalizeEntryDisplayName, normalizeGuestEmail } from '@/lib/guest-entry'

export const runtime = 'nodejs'

type JoinBody = {
  passcode?: unknown
  displayName?: unknown
  notificationEmail?: unknown
}

type UpdateBody = {
  entryId?: unknown
  token?: unknown
  displayName?: unknown
  notificationEmail?: unknown
  golferPicks?: unknown
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 })
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as JoinBody
    const passcode = typeof body.passcode === 'string'
      ? body.passcode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
      : ''
    const displayName = normalizeEntryDisplayName(body.displayName)
    const notificationEmail = normalizeGuestEmail(body.notificationEmail)

    if (passcode.length !== 6) return badRequest('Enter the full pool code from your host.')
    if (!displayName) return badRequest('Enter a leaderboard name.')
    if (body.notificationEmail && typeof body.notificationEmail === 'string' && body.notificationEmail.trim() && !notificationEmail) {
      return badRequest('Enter a valid email address or leave it blank.')
    }

    const supabase = createServiceClient() as any
    const { data: pool, error: poolError } = await supabase
      .from('gpp_pools')
      .select('id, is_locked, gpp_tournaments(status)')
      .eq('passcode', passcode)
      .maybeSingle()

    if (poolError || !pool) return NextResponse.json({ error: 'Invalid passcode. Check with the pool host.' }, { status: 404 })
    const tournament = Array.isArray(pool.gpp_tournaments) ? pool.gpp_tournaments[0] : pool.gpp_tournaments
    const picksClosed = pool.is_locked || tournament?.status === 'live' || tournament?.status === 'completed'
    if (picksClosed) return NextResponse.json({ error: 'This pool is locked. Picks have closed.' }, { status: 409 })

    const token = createGuestEntryToken()
    const insertPayload: Record<string, unknown> = {
      pool_id: pool.id,
      user_id: null,
      display_name: displayName,
      notification_email: notificationEmail,
      golfer_picks: [],
      guest_entry_token_hash: hashGuestEntryToken(token),
    }

    let { data: entry, error: insertError } = await supabase
      .from('gpp_entries')
      .insert(insertPayload)
      .select('id')
      .single()

    // Production may be a deploy ahead of the notification_email migration.
    // Keep no-account joining live; email capture starts as soon as the column exists.
    if (insertError?.message?.includes('notification_email')) {
      delete insertPayload.notification_email
      const retry = await supabase
        .from('gpp_entries')
        .insert(insertPayload)
        .select('id')
        .single()
      entry = retry.data
      insertError = retry.error
    }

    if (insertError || !entry) {
      return NextResponse.json({ error: insertError?.message || 'Could not join this pool.' }, { status: 500 })
    }

    return NextResponse.json({ poolId: pool.id, entryId: entry.id, token })
  } catch {
    return NextResponse.json({ error: 'Could not join this pool.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as UpdateBody
    const entryId = typeof body.entryId === 'string' ? body.entryId : ''
    const token = typeof body.token === 'string' ? body.token : ''
    if (!entryId || !token) return badRequest('Missing guest entry token.')

    const supabase = createServiceClient() as any
    const { data: entry, error: entryError } = await supabase
      .from('gpp_entries')
      .select('id, pool_id, guest_entry_token_hash, gpp_pools(is_locked, gpp_tournaments(status))')
      .eq('id', entryId)
      .maybeSingle()

    if (entryError || !entry) return NextResponse.json({ error: 'Entry not found.' }, { status: 404 })
    if (hashGuestEntryToken(token) !== entry.guest_entry_token_hash) {
      return NextResponse.json({ error: 'Guest entry token is invalid.' }, { status: 403 })
    }

    const pool = Array.isArray(entry.gpp_pools) ? entry.gpp_pools[0] : entry.gpp_pools
    const tournament = Array.isArray(pool?.gpp_tournaments) ? pool.gpp_tournaments[0] : pool?.gpp_tournaments
    const picksClosed = pool?.is_locked || tournament?.status === 'live' || tournament?.status === 'completed'

    const update: Record<string, unknown> = {}
    if (body.displayName !== undefined) {
      const displayName = normalizeEntryDisplayName(body.displayName)
      if (!displayName) return badRequest('Entry name cannot be blank.')
      update.display_name = displayName
    }
    if (body.notificationEmail !== undefined) {
      const notificationEmail = normalizeGuestEmail(body.notificationEmail)
      if (typeof body.notificationEmail === 'string' && body.notificationEmail.trim() && !notificationEmail) {
        return badRequest('Enter a valid email address or leave it blank.')
      }
      update.notification_email = notificationEmail
    }
    if (body.golferPicks !== undefined) {
      if (picksClosed) return NextResponse.json({ error: 'Picks are closed for this pool.' }, { status: 409 })
      if (!Array.isArray(body.golferPicks) || body.golferPicks.some(pick => typeof pick !== 'string')) {
        return badRequest('Invalid picks.')
      }
      update.golfer_picks = body.golferPicks
    }

    if (Object.keys(update).length === 0) return badRequest('Nothing to update.')

    let { data: updatedEntry, error: updateError } = await supabase
      .from('gpp_entries')
      .update(update)
      .eq('id', entry.id)
      .select('*')
      .single()

    if (updateError?.message?.includes('notification_email')) {
      delete update.notification_email
      const retry = await supabase
        .from('gpp_entries')
        .update(update)
        .eq('id', entry.id)
        .select('*')
        .single()
      updatedEntry = retry.data
      updateError = retry.error
    }

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
    return NextResponse.json({ entry: updatedEntry })
  } catch {
    return NextResponse.json({ error: 'Could not update guest entry.' }, { status: 500 })
  }
}
