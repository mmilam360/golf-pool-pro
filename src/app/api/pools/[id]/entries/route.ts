import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceSupabase = createServiceClient() as any
  const { data: pool, error: poolError } = await serviceSupabase
    .from('gpp_pools')
    .select('id, owner_id')
    .eq('id', id)
    .maybeSingle()
  if (poolError || !pool) return NextResponse.json({ error: 'Pool not found.' }, { status: 404 })
  if (pool.owner_id !== user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { data: entries, error: entriesError } = await serviceSupabase
    .from('gpp_entries')
    .select('id, pool_id, user_id, display_name, golfer_picks, total_score, counting_scores, rank, has_paid, payout_amount, is_removed, removed_reason, removed_at, full_name, full_name_confirmed_at, notification_email, created_at')
    .eq('pool_id', id)
    .order('created_at', { ascending: true })
  if (entriesError) return NextResponse.json({ error: entriesError.message }, { status: 500 })

  const accountUserIds = Array.from(new Set((entries || []).map((entry: any) => entry.user_id).filter(Boolean)))
  const { data: profiles } = accountUserIds.length
    ? await serviceSupabase
      .from('gpp_profiles')
      .select('id, email, full_name, full_name_confirmed_at')
      .in('id', accountUserIds)
    : { data: [] }
  const profileByUserId = new Map((profiles || []).map((profile: any) => [profile.id, profile]))
  const hydratedEntries = (entries || []).map((entry: any) => {
    if (!entry.user_id) return entry
    const profile = profileByUserId.get(entry.user_id) as any
    return {
      ...entry,
      account_email: profile?.email || '',
      account_full_name: profile?.full_name_confirmed_at ? profile?.full_name || '' : '',
      account_full_name_confirmed_at: profile?.full_name_confirmed_at || null,
    }
  })

  return NextResponse.json({ entries: hydratedEntries })
}
