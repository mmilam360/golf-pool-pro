import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const supabase = (await createClient()) as any
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { poolId, entryId, confirmed } = await request.json()

    if (typeof poolId !== 'string' || typeof entryId !== 'string' || typeof confirmed !== 'boolean') {
      return NextResponse.json({ error: 'Missing confirmation details' }, { status: 400 })
    }

    const { data: pool, error: poolError } = await supabase
      .from('gpp_pools')
      .select('id, owner_id')
      .eq('id', poolId)
      .single()

    if (poolError || !pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
    }

    if (pool.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const serviceSupabase = createServiceClient() as any
    const { data: entry, error: updateError } = await serviceSupabase
      .from('gpp_entries')
      .update({ has_paid: confirmed } as any)
      .eq('id', entryId)
      .eq('pool_id', poolId)
      .eq('is_removed', false)
      .select('id, has_paid')
      .single()

    if (updateError || !entry) {
      return NextResponse.json({ error: 'Entry could not be updated' }, { status: 500 })
    }

    return NextResponse.json({ success: true, entry })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Entry could not be updated' }, { status: 500 })
  }
}
