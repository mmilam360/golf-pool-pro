import { NextResponse } from 'next/server'
import { syncTournaments } from '@/lib/tournament-sync'

export const runtime = 'nodejs'

export async function GET(request: Request) {
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
