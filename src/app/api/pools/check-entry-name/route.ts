export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { entryNameTaken, normalizeEntryName } from '@/lib/entry-name'

export async function POST(request: Request) {
  const { poolId, displayName } = await request.json().catch(() => ({}))
  const normalizedName = normalizeEntryName(displayName)

  if (!poolId || typeof poolId !== 'string' || !normalizedName) {
    return NextResponse.json({ ok: false, error: 'Missing pool or entry name.' }, { status: 400 })
  }

  const supabase = createServiceClient() as any
  try {
    const taken = await entryNameTaken(supabase, poolId, normalizedName)
    return NextResponse.json({ ok: true, available: !taken })
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not check this entry name.' }, { status: 500 })
  }
}
