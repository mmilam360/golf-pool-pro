import { NextResponse } from 'next/server'
import { syncTournaments } from '@/lib/tournament-sync'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET
  if (expectedSecret) {
    const { searchParams } = new URL(request.url)
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || searchParams.get('token')
    if (token !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const { searchParams } = new URL(request.url)
  const season = Number(searchParams.get('season')) || new Date().getFullYear()
  const doLive = searchParams.get('live') === '1' || searchParams.get('live') === 'true'

  try {
    const result = await syncTournaments({ season, doLive })
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
