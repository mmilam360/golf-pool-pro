export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getLeaderboard } from '@/lib/golf-api'

function validEventId(eventId: string | null) {
  return Boolean(eventId && /^\d{3,20}$/.test(eventId))
}

function hasUsableLeaderboard(leaderboard: unknown) {
  if (!Array.isArray(leaderboard) || leaderboard.length === 0) return false
  const namedRows = leaderboard.filter(player => {
    const name = String((player as any)?.name || '').trim().toLowerCase()
    return name && name !== 'unknown'
  }).length
  return namedRows >= Math.max(1, Math.ceil(leaderboard.length * 0.5))
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get('id')
  if (!eventId) return NextResponse.json({ error: 'Missing event id' }, { status: 400 })
  if (!validEventId(eventId)) return NextResponse.json({ error: 'Invalid event id' }, { status: 400 })

  try {
    const tournament = await getLeaderboard(eventId)
    if (!tournament) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!hasUsableLeaderboard(tournament.leaderboard)) {
      return NextResponse.json({ error: 'Leaderboard unavailable' }, { status: 502 })
    }
    return NextResponse.json(tournament, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch {
    return NextResponse.json({ error: 'Leaderboard unavailable' }, { status: 502 })
  }
}
