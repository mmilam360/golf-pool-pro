const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/golf'
const ESPN_CORE_EVENTS = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/events'
const ESPN_SCOREBOARD = `${ESPN_BASE}/pga/scoreboard`
const NEXT_REVALIDATE_HOURLY = { next: { revalidate: 3600 } } as RequestInit
const NEXT_REVALIDATE_FAST = { next: { revalidate: 60 } } as RequestInit
const NEXT_REVALIDATE_MEDIUM = { next: { revalidate: 300 } } as RequestInit

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

function httpsRef(ref?: string) {
  return ref?.replace('http://', 'https://')
}

function parseScoreToPar(score: unknown): number {
  if (score == null || score === '' || score === 'E') return 0
  if (typeof score === 'number') return score
  const normalized = String(score).replace('+', '')
  const parsed = parseInt(normalized, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/)
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') }
}

export function mapCompetitorToPlayer(competitor: any): GolfPlayer {
  const athlete = competitor.athlete || {}
  const name = athlete.displayName || athlete.fullName || competitor.displayName || competitor.name || 'Unknown'
  const split = splitName(name)
  const statusName = String(competitor.status?.type?.name || competitor.status?.type?.description || '').toLowerCase()
  const score = competitor.score?.displayValue ?? competitor.score ?? competitor.displayScore ?? 'E'

  return {
    id: String(athlete.id || competitor.id || name),
    name,
    firstName: athlete.firstName || split.firstName,
    lastName: athlete.lastName || split.lastName,
    score: String(score),
    scoreToPar: parseScoreToPar(score),
    thru: competitor.thru || competitor.statistics?.find?.((s: any) => s.name === 'thru')?.displayValue || '',
    roundScore: competitor.roundScore || '',
    position: String(competitor.order || competitor.rank || competitor.position || ''),
    strokes: Number(competitor.strokeTotal || competitor.strokes || 0),
    status: statusName.includes('cut') ? 'cut' : statusName.includes('wd') ? 'wd' : 'active',
    country: athlete.country || athlete.flag?.alt || '',
    image: athlete.headshot?.href,
  }
}

function eventStatus(event: any): 'upcoming' | 'live' | 'completed' {
  const state = event.status?.type?.state || event.competitions?.[0]?.status?.type?.state
  const name = event.status?.type?.name || event.competitions?.[0]?.status?.type?.name
  if (state === 'in' || name === 'STATUS_IN_PROGRESS') return 'live'
  if (state === 'post' || name === 'STATUS_FINAL') return 'completed'

  const end = new Date(event.endDate || event.date)
  if (Number.isFinite(end.getTime()) && end < new Date()) return 'completed'
  return 'upcoming'
}

export async function getSchedule(season: number = new Date().getFullYear()): Promise<any[]> {
  const res = await fetch(`${ESPN_CORE_EVENTS}?dates=${season}&limit=1000`, NEXT_REVALIDATE_HOURLY)
  if (!res.ok) throw new Error(`ESPN core schedule: ${res.status}`)
  const data = await res.json()
  const refs = (data.items || []).map((item: any) => httpsRef(item.$ref)).filter(Boolean)

  const events = await Promise.all(refs.map(async (ref: string) => {
    const eventRes = await fetch(ref, NEXT_REVALIDATE_HOURLY)
    if (!eventRes.ok) return null
    const event = await eventRes.json()
    const course = event.courses?.find?.((c: any) => c.host) || event.courses?.[0]
    return {
      id: event.id,
      name: event.name,
      date: event.date,
      endDate: event.endDate || event.date,
      venue: { fullName: course?.name || event.venues?.[0]?.fullName || null },
      course,
      status: eventStatus(event),
      competitions: event.competitions || [],
    }
  }))

  return events.filter(Boolean)
}

export async function getLeaderboard(eventId: string): Promise<GolfTournament | null> {
  const scoreboardRes = await fetch(ESPN_SCOREBOARD, NEXT_REVALIDATE_FAST)
  if (scoreboardRes.ok) {
    const scoreboard = await scoreboardRes.json()
    const event = (scoreboard.events || []).find((candidate: any) => String(candidate.id) === String(eventId))
    if (event) {
      const competition = event.competitions?.[0]
      const players = (competition?.competitors || []).map(mapCompetitorToPlayer)
      return {
        id: event.id,
        name: event.name,
        startDate: event.date,
        endDate: event.endDate || event.date,
        course: event.courses?.[0]?.name || event.venue?.fullName || '',
        location: event.venue?.address?.city || event.courses?.[0]?.address?.city || '',
        status: eventStatus(event),
        round: event.status?.period || competition?.status?.period || 0,
        leaderboard: players,
      }
    }
  }

  const res = await fetch(`${ESPN_CORE_EVENTS}/${eventId}?lang=en&region=us`, NEXT_REVALIDATE_MEDIUM)
  if (!res.ok) throw new Error(`ESPN event: ${res.status}`)
  const event = await res.json()
  const competition = event.competitions?.[0]
  const players = (competition?.competitors || []).map(mapCompetitorToPlayer)

  return {
    id: event.id,
    name: event.name,
    startDate: event.date,
    endDate: event.endDate || event.date,
    course: event.courses?.find?.((c: any) => c.host)?.name || event.courses?.[0]?.name || '',
    location: event.courses?.[0]?.address?.city || '',
    status: eventStatus(event),
    round: 0,
    leaderboard: players,
  }
}
