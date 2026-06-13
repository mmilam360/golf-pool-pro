import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { hashGuestEntryToken } from '@/lib/guest-entry'

export const runtime = 'nodejs'

function redirectToPool(request: Request, poolId: string, search = '') {
  return NextResponse.redirect(new URL(`/pool/${poolId}${search}`, request.url))
}

function redirectToJoin(request: Request) {
  return NextResponse.redirect(new URL('/pool/join', request.url))
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const poolId = url.searchParams.get('poolId') || ''
  const token = url.searchParams.get('token') || ''

  if (!poolId || !token) return redirectToJoin(request)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    const redirectPath = `/api/pool/claim-guest-entry?poolId=${encodeURIComponent(poolId)}&token=${encodeURIComponent(token)}`
    return NextResponse.redirect(new URL(`/login?redirect=${encodeURIComponent(redirectPath)}`, request.url))
  }

  const serviceSupabase = createServiceClient() as any
  const tokenHash = hashGuestEntryToken(token)
  const { data: guestEntry, error: guestError } = await serviceSupabase
    .from('gpp_entries')
    .select('id, pool_id, user_id, is_removed')
    .eq('pool_id', poolId)
    .eq('guest_entry_token_hash', tokenHash)
    .eq('is_removed', false)
    .maybeSingle()

  if (guestError || !guestEntry) return redirectToPool(request, poolId, '?claim=not-found')
  if (guestEntry.user_id) return redirectToPool(request, poolId, '?claim=already-linked')

  const { data: existingEntry } = await serviceSupabase
    .from('gpp_entries')
    .select('id')
    .eq('pool_id', poolId)
    .eq('user_id', user.id)
    .eq('is_removed', false)
    .maybeSingle()

  if (existingEntry) return redirectToPool(request, poolId, '?claim=existing-entry')

  const { error: updateError } = await serviceSupabase
    .from('gpp_entries')
    .update({
      user_id: user.id,
      claimed_at: new Date().toISOString(),
      guest_entry_token_hash: null,
    })
    .eq('id', guestEntry.id)

  if (updateError) return redirectToPool(request, poolId, '?claim=error')

  return redirectToPool(request, poolId, '?claim=linked')
}
