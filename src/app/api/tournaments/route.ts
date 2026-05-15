export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { getSchedule, getLeaderboard } from '@/lib/golf-api'

function validEventId(eventId: string | null) {
  return Boolean(eventId && /^\d{3,20}$/.test(eventId))
}

function parseSeason(value: string | null) {
  const year = Number.parseInt(value || String(new Date().getFullYear()), 10)
  const current = new Date().getFullYear()
  if (!Number.isFinite(year) || year < current - 1 || year > current + 2) return null
  return year
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  try {
    if (action === 'schedule') {
      const season = parseSeason(searchParams.get('season'))
      if (!season) return NextResponse.json({ error: 'Invalid season' }, { status: 400 })
      const events = await getSchedule(season)
      return NextResponse.json({ events })
    }

    if (action === 'leaderboard') {
      const eventId = searchParams.get('id')
      if (!eventId) return NextResponse.json({ error: 'Missing event id' }, { status: 400 })
      if (!validEventId(eventId)) return NextResponse.json({ error: 'Invalid event id' }, { status: 400 })
      const tournament = await getLeaderboard(eventId)
      if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
      return NextResponse.json(tournament)
    }

    // Default: sync upcoming tournaments to DB
    const events = await getSchedule()
    const upcoming = events.filter((e: any) => {
      const endDate = new Date(e.endDate || e.date)
      return endDate >= new Date()
    })

    // Return list of syncable tournaments
    return NextResponse.json({
      count: upcoming.length,
      tournaments: upcoming.map((e: any) => ({
        id: e.id,
        name: e.name,
        date: e.date,
        endDate: e.endDate,
        venue: e.venue?.fullName,
      }))
    })
  } catch {
    return NextResponse.json({ error: 'Tournament data unavailable' }, { status: 502 })
  }
}
