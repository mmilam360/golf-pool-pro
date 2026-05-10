export const runtime = 'edge';
import { NextResponse } from 'next/server'
import { getLeaderboard } from '@/lib/golf-api'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get('id')
  if (!eventId) return NextResponse.json({ error: 'Missing event id' }, { status: 400 })

  try {
    const tournament = await getLeaderboard(eventId)
    if (!tournament) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(tournament)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
