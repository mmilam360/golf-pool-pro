export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { getLeaderboard } from '@/lib/golf-api'

function validEventId(eventId: string | null) {
  return Boolean(eventId && /^\d{3,20}$/.test(eventId))
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get('id')
  if (!eventId) return NextResponse.json({ error: 'Missing event id' }, { status: 400 })
  if (!validEventId(eventId)) return NextResponse.json({ error: 'Invalid event id' }, { status: 400 })

  try {
    const tournament = await getLeaderboard(eventId)
    if (!tournament) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(tournament)
  } catch {
    return NextResponse.json({ error: 'Leaderboard unavailable' }, { status: 502 })
  }
}
