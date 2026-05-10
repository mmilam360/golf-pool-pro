const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/golf'

export interface GolfPlayer {
  id: string; name: string; firstName: string; lastName: string
  score: string; scoreToPar: number; thru: string; roundScore: string
  position: string; strokes: number
  status: 'active' | 'cut' | 'wd' | 'dnq'; country: string; image?: string
}

export interface GolfTournament {
  id: string; name: string; startDate: string; endDate: string
  course: string; location: string
  status: 'upcoming' | 'live' | 'completed'; round: number
  leaderboard: GolfPlayer[]
}

export async function getSchedule(season: number = 2026): Promise<any[]> {
  const res = await fetch(`${ESPN_BASE}/pga/schedule?season=${season}`, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`ESPN schedule: ${res.status}`)
  const data = await res.json()
  return data.events || []
}

export async function getLeaderboard(eventId: string): Promise<GolfTournament | null> {
  const res = await fetch(`${ESPN_BASE}/pga/summary?event=${eventId}`, { next: { revalidate: 60 } })
  if (!res.ok) throw new Error(`ESPN leaderboard: ${res.status}`)
  const data = await res.json()
  const event = data.events?.[0]
  if (!event) return null

  const players: GolfPlayer[] = (data.leaders || []).map((p: any) => {
    const scoreStr = p.score || 'E'
    let scoreToPar = 0
    if (scoreStr === 'E') scoreToPar = 0
    else if (scoreStr.startsWith('+')) scoreToPar = parseInt(scoreStr)
    else scoreToPar = parseInt(scoreStr)
    return {
      id: String(p.athlete?.id || p.id),
      name: p.athlete?.displayName || p.name || '',
      firstName: p.athlete?.firstName || '', lastName: p.athlete?.lastName || '',
      score: scoreStr, scoreToPar, thru: p.thru || '', roundScore: p.roundScore || '',
      position: p.rank?.toString() || '', strokes: p.strokeTotal || p.strokes || 0,
      status: p.status?.type?.name === 'cut' ? 'cut' : p.status?.type?.name === 'wd' ? 'wd' : 'active',
      country: p.athlete?.country || '', image: p.athlete?.headshot?.href,
    }
  })

  return {
    id: event.id, name: event.name, startDate: event.date, endDate: event.endDate || event.date,
    course: event.courses?.[0]?.name || '', location: event.venue?.address?.city || '',
    status: event.status?.type?.name === 'in' ? 'live' : event.status?.type?.name === 'post' ? 'completed' : 'upcoming',
    round: event.status?.period || 0, leaderboard: players,
  }
}
