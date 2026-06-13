import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEntrySavedEmail } from '@/lib/entry-saved-email'

export const runtime = 'nodejs'

type Body = {
  poolId?: unknown
  entryId?: unknown
  token?: unknown
}

export async function POST(request: Request) {
  let body: Body = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const poolId = typeof body.poolId === 'string' ? body.poolId : ''
  const entryId = typeof body.entryId === 'string' ? body.entryId : ''
  const token = typeof body.token === 'string' ? body.token : null
  if (!poolId || !entryId) return NextResponse.json({ error: 'Missing entry details' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!token && !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
    const result = await sendEntrySavedEmail({ entryId, poolId, token, userId: user?.id || null, origin })
    return NextResponse.json({ ok: true, result })
  } catch (error: any) {
    console.error('entry_saved_email_failed', error)
    return NextResponse.json({ error: 'Entry email could not be sent' }, { status: 500 })
  }
}
