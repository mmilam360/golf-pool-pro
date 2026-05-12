export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { getSchedule, getLeaderboard } from '@/lib/golf-api'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  try {
    if (action === 'schedule') {
      const season = parseInt(searchParams.get('season') || '2026')
      const events = await getSchedule(season)
      return NextResponse.json({ events })
    }

    if (action === 'leaderboard') {
      const eventId = searchParams.get('id')
      if (!eventId) return NextResponse.json({ error: 'Missing event id' }, { status: 400 })
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
