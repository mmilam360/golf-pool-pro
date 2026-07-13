import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { normalizeEntryDisplayName, normalizeFullName, normalizeGuestEmail } from '@/lib/guest-entry'
import { DUPLICATE_ENTRY_NAME_MESSAGE, entryNameTaken, isDuplicateEntryNameError } from '@/lib/entry-name'
import { validatePickSubmission } from '@/lib/pick-submission-validation'
import { entryProcessIsClosed } from '@/lib/entry-process-state'

export const runtime = 'nodejs'

type UpdateBody = {
  entryId?: unknown
  poolId?: unknown
  displayName?: unknown
  fullName?: unknown
  golferPicks?: unknown
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 })
}

export async function PATCH(request: Request) {
  try {
    const authSupabase = await createClient()
    const { data: { user } } = await authSupabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as UpdateBody
    const entryId = typeof body.entryId === 'string' ? body.entryId : ''
    const poolId = typeof body.poolId === 'string' ? body.poolId : ''
    if (!entryId || !poolId) return badRequest('Missing entry details.')

    const supabase = createServiceClient() as any
    const { data: entry, error: entryError } = await supabase
      .from('gpp_entries')
      .select('id, pool_id, user_id, full_name, full_name_confirmed_at, notification_email, gpp_pools(is_locked, is_completed, results_finalized_at, require_entry_email, pick_count, game_format, group_count, picks_per_group, pick_groups_json, groups_finalized_at, gpp_tournaments(status, start_date, end_date, field_json, leaderboard_json))')
      .eq('id', entryId)
      .eq('pool_id', poolId)
      .eq('user_id', user.id)
      .eq('is_removed', false)
      .maybeSingle()

    if (entryError || !entry) return NextResponse.json({ error: 'Entry not found.' }, { status: 404 })

    const pool = Array.isArray(entry.gpp_pools) ? entry.gpp_pools[0] : entry.gpp_pools
    const tournament = Array.isArray(pool?.gpp_tournaments) ? pool.gpp_tournaments[0] : pool?.gpp_tournaments
    const picksClosed = entryProcessIsClosed(pool, tournament)

    const { data: profile } = await supabase
      .from('gpp_profiles')
      .select('full_name, full_name_confirmed_at, email')
      .eq('id', user.id)
      .maybeSingle()

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

    const entryFullName = normalizeFullName(entry.full_name)
    if ((!entryFullName || !entry.full_name_confirmed_at) && update.full_name === undefined) {
      const profileFullName = profile?.full_name_confirmed_at ? normalizeFullName(profile.full_name) : null
      if (!profileFullName) return badRequest('Add and confirm your full name in Account before updating this entry.')
      update.full_name = profileFullName
      update.full_name_confirmed_at = profile.full_name_confirmed_at
    }

    if (pool.require_entry_email) {
      const accountEmail = normalizeGuestEmail(user.email || profile?.email)
      if (!accountEmail) return badRequest('The pool runner requires an email. Add a valid email to your account before updating this entry.')
      update.notification_email = accountEmail
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
      .eq('pool_id', poolId)
      .eq('user_id', user.id)
      .eq('is_removed', false)
      .select('id, pool_id, user_id, display_name, golfer_picks, total_score, counting_scores, rank, has_paid, payout_amount, is_removed, removed_reason, removed_at, full_name, full_name_confirmed_at, notification_email, created_at')
      .single()

    if (updateError || !updatedEntry) {
      const message = isDuplicateEntryNameError(updateError) ? DUPLICATE_ENTRY_NAME_MESSAGE : updateError?.message || 'Entry could not be updated.'
      return NextResponse.json({ error: message }, { status: isDuplicateEntryNameError(updateError) ? 409 : 500 })
    }

    return NextResponse.json({ entry: updatedEntry })
  } catch {
    return NextResponse.json({ error: 'Could not update entry.' }, { status: 500 })
  }
}
