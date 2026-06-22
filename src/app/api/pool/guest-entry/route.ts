import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createGuestEntryToken, guestEntryTokenMatches, hashGuestEntryToken, normalizeEntryDisplayName, normalizeFullName, normalizeGuestEmail } from '@/lib/guest-entry'
import { DUPLICATE_ENTRY_NAME_MESSAGE, entryNameTaken, isDuplicateEntryNameError } from '@/lib/entry-name'
import { validatePickSubmission } from '@/lib/pick-submission-validation'
import { entryProcessIsClosed } from '@/lib/entry-process-state'

export const runtime = 'nodejs'

type JoinBody = {
  passcode?: unknown
  displayName?: unknown
  fullName?: unknown
  notificationEmail?: unknown
}

type UpdateBody = {
  entryId?: unknown
  token?: unknown
  displayName?: unknown
  fullName?: unknown
  notificationEmail?: unknown
  golferPicks?: unknown
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 })
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const poolId = url.searchParams.get('poolId') || ''
  const passcode = (url.searchParams.get('passcode') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
  const lookupByPoolId = /^[0-9a-f-]{36}$/i.test(poolId)
  if (!lookupByPoolId && passcode.length !== 6) return badRequest('Enter the full pool code from your host.')

  const supabase = createServiceClient() as any
  const query = supabase
    .from('gpp_pools')
    .select('id, name, passcode, is_locked, is_completed, results_finalized_at, gpp_tournaments(name, status, start_date, end_date, leaderboard_json)')

  const { data: pool, error: poolError } = lookupByPoolId
    ? await query.eq('id', poolId).maybeSingle()
    : await query.eq('passcode', passcode).maybeSingle()

  if (poolError || !pool) return NextResponse.json({ error: 'Invalid passcode. Check with the pool host.' }, { status: 404 })
  const tournament = Array.isArray(pool.gpp_tournaments) ? pool.gpp_tournaments[0] : pool.gpp_tournaments
  const picksClosed = entryProcessIsClosed(pool, tournament)
  if (lookupByPoolId && picksClosed) return NextResponse.json({ error: 'This pool is locked. Picks have closed.' }, { status: 409 })
  return NextResponse.json({
    poolId: pool.id,
    poolName: pool.name,
    passcode: pool.passcode,
    tournamentName: tournament?.name || '',
    picksClosed,
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as JoinBody
    const passcode = typeof body.passcode === 'string'
      ? body.passcode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
      : ''
    const displayName = normalizeEntryDisplayName(body.displayName)
    const fullName = normalizeFullName(body.fullName)
    const notificationEmail = normalizeGuestEmail(body.notificationEmail)

    if (passcode.length !== 6) return badRequest('Enter the full pool code from your host.')
    if (!displayName) return badRequest('Enter a leaderboard name.')
    if (!fullName) return badRequest('Enter your full name for the pool runner.')
    if (body.notificationEmail && typeof body.notificationEmail === 'string' && body.notificationEmail.trim() && !notificationEmail) {
      return badRequest('Enter a valid email address or leave it blank.')
    }

    const supabase = createServiceClient() as any
    const { data: pool, error: poolError } = await supabase
      .from('gpp_pools')
      .select('id, is_locked, is_completed, results_finalized_at, gpp_tournaments(status, start_date, end_date, leaderboard_json)')
      .eq('passcode', passcode)
      .maybeSingle()

    if (poolError || !pool) return NextResponse.json({ error: 'Invalid passcode. Check with the pool host.' }, { status: 404 })
    const tournament = Array.isArray(pool.gpp_tournaments) ? pool.gpp_tournaments[0] : pool.gpp_tournaments
    const picksClosed = entryProcessIsClosed(pool, tournament)
    if (picksClosed) return NextResponse.json({ error: 'This pool is locked. Picks have closed.' }, { status: 409 })

    const nameTaken = await entryNameTaken(supabase, pool.id, displayName)
    if (nameTaken) return NextResponse.json({ error: DUPLICATE_ENTRY_NAME_MESSAGE }, { status: 409 })

    const token = createGuestEntryToken()
    const insertPayload: Record<string, unknown> = {
      pool_id: pool.id,
      user_id: null,
      display_name: displayName,
      full_name: fullName,
      full_name_confirmed_at: new Date().toISOString(),
      notification_email: notificationEmail,
      golfer_picks: [],
      guest_entry_token_hash: hashGuestEntryToken(token),
    }

    const { data: entry, error: insertError } = await supabase
      .from('gpp_entries')
      .insert(insertPayload)
      .select('id')
      .single()

    if (insertError || !entry) {
      const message = isDuplicateEntryNameError(insertError) ? DUPLICATE_ENTRY_NAME_MESSAGE : insertError?.message || 'Could not join this pool.'
      return NextResponse.json({ error: message }, { status: isDuplicateEntryNameError(insertError) ? 409 : 500 })
    }

    if (notificationEmail) {
      const { error: emailUpdateError } = await supabase
        .from('gpp_entries')
        .update({ notification_email: notificationEmail } as any)
        .eq('id', entry.id)
      if (emailUpdateError) {
        return NextResponse.json({ error: emailUpdateError.message || 'Could not save notification email.' }, { status: 500 })
      }
    }

    return NextResponse.json({ poolId: pool.id, entryId: entry.id, token, notificationEmailSaved: Boolean(notificationEmail) })
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
      .select('id, pool_id, user_id, guest_entry_token_hash, gpp_pools(is_locked, is_completed, results_finalized_at, pick_count, game_format, group_count, picks_per_group, pick_groups_json, groups_finalized_at, gpp_tournaments(status, start_date, end_date, field_json, leaderboard_json))')
      .eq('id', entryId)
      .eq('is_removed', false)
      .is('user_id', null)
      .maybeSingle()

    if (entryError || !entry) return NextResponse.json({ error: 'Entry not found.' }, { status: 404 })
    if (!await guestEntryTokenMatches(supabase, entry, token)) {
      return NextResponse.json({ error: 'Guest entry token is invalid.' }, { status: 403 })
    }

    const pool = Array.isArray(entry.gpp_pools) ? entry.gpp_pools[0] : entry.gpp_pools
    const tournament = Array.isArray(pool?.gpp_tournaments) ? pool.gpp_tournaments[0] : pool?.gpp_tournaments
    const picksClosed = entryProcessIsClosed(pool, tournament)

    const update: Record<string, unknown> = {}
    if (body.displayName !== undefined) {
      if (picksClosed) return NextResponse.json({ error: 'Entry names are locked for this pool.' }, { status: 409 })
      const displayName = normalizeEntryDisplayName(body.displayName)
      if (!displayName) return badRequest('Entry name cannot be blank.')
      const nameTaken = await entryNameTaken(supabase, entry.pool_id, displayName, entry.id)
      if (nameTaken) return NextResponse.json({ error: DUPLICATE_ENTRY_NAME_MESSAGE }, { status: 409 })
      update.display_name = displayName
    }
    if (body.fullName !== undefined) {
      const fullName = normalizeFullName(body.fullName)
      if (!fullName) return badRequest('Enter your full name for the pool runner.')
      update.full_name = fullName
      update.full_name_confirmed_at = new Date().toISOString()
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
      const pickError = validatePickSubmission(pool, body.golferPicks)
      if (pickError) return badRequest(pickError)
      update.golfer_picks = body.golferPicks
    }

    if (Object.keys(update).length === 0) return badRequest('Nothing to update.')

    const { data: updatedEntry, error: updateError } = await supabase
      .from('gpp_entries')
      .update(update)
      .eq('id', entry.id)
      .eq('pool_id', entry.pool_id)
      .eq('is_removed', false)
      .is('user_id', null)
      .select('id, pool_id, user_id, display_name, golfer_picks, total_score, counting_scores, rank, has_paid, payout_amount, is_removed, removed_reason, removed_at, full_name, full_name_confirmed_at, notification_email, created_at')
      .single()

    if (updateError) {
      const message = isDuplicateEntryNameError(updateError) ? DUPLICATE_ENTRY_NAME_MESSAGE : updateError.message
      return NextResponse.json({ error: message }, { status: isDuplicateEntryNameError(updateError) ? 409 : 500 })
    }
    return NextResponse.json({ entry: updatedEntry })
  } catch {
    return NextResponse.json({ error: 'Could not update guest entry.' }, { status: 500 })
  }
}
