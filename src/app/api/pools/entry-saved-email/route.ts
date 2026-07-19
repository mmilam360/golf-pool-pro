import { NextResponse } from 'next/server'
import { sendEntrySavedEmail } from '@/lib/entry-saved-email'

export const runtime = 'nodejs'

export async function POST() {
  const result = await sendEntrySavedEmail({ entryId: '', poolId: '', origin: '' })
  return NextResponse.json({ ok: true, result })
}
