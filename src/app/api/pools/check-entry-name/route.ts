export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { normalizeEntryName } from '@/lib/entry-name'

export async function POST(request: Request) {
  const { poolId, displayName } = await request.json().catch(() => ({}))
  const normalizedName = normalizeEntryName(displayName)

  if (!poolId || typeof poolId !== 'string' || !normalizedName) {
    return NextResponse.json({ ok: false, error: 'Missing pool or entry name.' }, { status: 400 })
  }

  const supabase = createServiceClient() as any
  const { data, error } = await supabase
    .from('gpp_entries')
    .select('id, display_name')
    .eq('pool_id', poolId)
    .eq('is_removed', false)

  if (error) {
    return NextResponse.json({ ok: false, error: 'Could not check this entry name.' }, { status: 500 })
  }

  const taken = (data || []).some((entry: { display_name?: string | null }) => normalizeEntryName(entry.display_name) === normalizedName)
  return NextResponse.json({ ok: true, available: !taken })
}
