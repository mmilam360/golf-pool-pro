const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/golf'
const ESPN_CORE_EVENTS = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/events'
const ESPN_SCOREBOARD = `${ESPN_BASE}/pga/scoreboard`
const NEXT_REVALIDATE_HOURLY = { next: { revalidate: 3600 } } as RequestInit
const NEXT_NO_STORE = { cache: 'no-store' } as RequestInit
const NEXT_REVALIDATE_FAST = { next: { revalidate: 60 } } as RequestInit
const NEXT_REVALIDATE_MEDIUM = { next: { revalidate: 300 } } as RequestInit

export interface GolfPlayer {
  id: string; name: string; firstName: string; lastName: string
  score: string; scoreToPar: number; thru: string; roundScore: string
  teeTime?: string; startTee?: number | null
  roundScores?: GolfRoundScore[]
  position: string; strokes: number
  status: 'active' | 'cut' | 'wd' | 'dnq'; country: string; image?: string
}

export interface GolfRoundScore {
  round: number
  roundScoreToPar: number
  cumulativeScoreToPar: number
  complete: boolean
}

export interface GolfCutLine {
  score: string
  scoreToPar: number
  count?: number
  projected: boolean
}

export interface GolfTournament {
  id: string; name: string; startDate: string; endDate: string
  course: string; location: string
  status: 'upcoming' | 'live' | 'completed'; round: number
  leaderboard: GolfPlayer[]
  cutLine?: GolfCutLine | null
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

function parseCutScore(score: unknown): number | null {
  if (score == null || score === '' || score === 'E') return 0
  const normalized = String(score).replace('+', '').trim()
  const parsed = parseInt(normalized, 10)
  return Number.isFinite(parsed) ? parsed : null
}

export function parseProjectedCutLineFromHtml(html: string): GolfCutLine | null {
  const match = html.match(/"cut"\s*:\s*\{\s*"score"\s*:\s*"([^"]+)"\s*,\s*"count"\s*:\s*(\d+)\s*,\s*"proj"\s*:\s*(true|false)/)
  if (!match) return null

  const scoreToPar = parseCutScore(match[1])
  if (scoreToPar == null) return null

  return {
    score: match[1],
    scoreToPar,
    count: Number(match[2]),
    projected: match[3] === 'true',
  }
}

async function getProjectedCutLine(eventId: string): Promise<GolfCutLine | null> {
  try {
    const res = await fetch(`https://www.espn.com/golf/leaderboard?tournamentId=${encodeURIComponent(eventId)}`, {
      ...NEXT_REVALIDATE_FAST,
      headers: { 'user-agent': 'Mozilla/5.0 GolfPoolsPro/1.0' },
    })
    if (!res.ok) return null
    return parseProjectedCutLineFromHtml(await res.text())
  } catch {
    return null
  }
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/)
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') }
}

function currentRoundLine(linescores: any[] | undefined) {
  const lines = Array.isArray(linescores) ? linescores : []
  return [...lines].reverse().find(line => Array.isArray(line.linescores) && line.linescores.length > 0)
    || [...lines].reverse().find(line => line?.displayValue && line.displayValue !== '-')
}

function thruFromLine(line: any) {
  const holes = Array.isArray(line?.linescores) ? line.linescores : []
  const completedHoles = holes.filter((hole: any) => hole?.value != null || hole?.displayValue)
  const completed = completedHoles.length
  if (completed <= 0) return ''
  if (completed >= 18) return 'F'

  const firstHole = Number(completedHoles[0]?.period)
  const startedOnBackNine = Number.isFinite(firstHole) && firstHole >= 10
  return `${completed}${startedOnBackNine ? '*' : ''}`
}

function completedHoleCount(line: any) {
  const holes = Array.isArray(line?.linescores) ? line.linescores : []
  return holes.filter((hole: any) => hole?.value != null || hole?.displayValue).length
}

function roundScoresFromLines(linescores: any[] | undefined): GolfRoundScore[] {
  const lines = Array.isArray(linescores) ? linescores : []
  let cumulative = 0
  return [...lines]
    .filter(line => Number.isFinite(Number(line?.period)) && line?.displayValue && line.displayValue !== '-')
    .sort((a, b) => Number(a.period) - Number(b.period))
    .map(line => {
      const roundScoreToPar = parseScoreToPar(line.displayValue)
      cumulative += roundScoreToPar
      return {
        round: Number(line.period),
        roundScoreToPar,
        cumulativeScoreToPar: cumulative,
        complete: completedHoleCount(line) >= 18,
      }
    })
}

function easternDateKey(value: Date | string) {
  const parsed = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(parsed.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed)
}

function hasLineStarted(line: any) {
  const holes = Array.isArray(line?.linescores) ? line.linescores : []
  return holes.some((hole: any) => hole?.value != null || hole?.displayValue)
}

type TeeInfo = { teeTime?: string; startTee?: number | null; roundScore?: string }

function teeInfoForToday(linescores: any): TeeInfo | null {
  const items = Array.isArray(linescores?.items) ? linescores.items : Array.isArray(linescores) ? linescores : []
  const today = easternDateKey(new Date())
  const todaysLine = items
    .filter((line: any) => line?.teeTime && easternDateKey(line.teeTime) === today)
    .sort((a: any, b: any) => Number(a.period || 0) - Number(b.period || 0))
    .at(-1)

  if (!todaysLine?.teeTime) return null
  const startTee = Number(todaysLine.startTee || todaysLine.startPosition || 0)
  return {
    teeTime: todaysLine.teeTime,
    startTee: Number.isFinite(startTee) && startTee > 0 ? startTee : null,
    roundScore: hasLineStarted(todaysLine) ? todaysLine.displayValue || '' : '',
  }
}

async function getCompetitorTeeInfo(eventId: string, competitionId: string, playerId: string): Promise<TeeInfo | null> {
  try {
    const res = await fetch(`${ESPN_CORE_EVENTS}/${eventId}/competitions/${competitionId}/competitors/${playerId}/linescores?lang=en&region=us`, NEXT_REVALIDATE_MEDIUM)
    if (!res.ok) return null
    return teeInfoForToday(await res.json())
  } catch {
    return null
  }
}

async function enrichPlayersWithTeeTimes(eventId: string, competitionId: string, players: GolfPlayer[]) {
  const entries = await Promise.all(players.map(async player => [player.id, await getCompetitorTeeInfo(eventId, competitionId, player.id)] as const))
  const teeByPlayerId = new Map(entries.filter(([, info]) => Boolean(info)))
  return players.map(player => {
    const teeInfo = teeByPlayerId.get(player.id)
    if (!teeInfo?.teeTime) return player
    return {
      ...player,
      teeTime: teeInfo.teeTime,
      startTee: teeInfo.startTee,
      roundScore: teeInfo.roundScore || '',
    }
  })
}

export function applyOfficialCutStatus(players: GolfPlayer[], cutLine?: GolfCutLine | null) {
  if (!cutLine || cutLine.projected || !Number.isFinite(cutLine.scoreToPar)) return players
  return players.map(player => {
    if (player.status !== 'active') return player
    if (player.scoreToPar <= cutLine.scoreToPar) return player
    // ESPN keeps missed-cut golfers in the scoreboard with their Friday round line as
    // roundScore/thru. If there is no tee time/current-round line for today after the
    // official cut, treat them as cut so pool scoring and display stop ranking them
    // above worse-scoring golfers who actually made the weekend.
    if (player.teeTime) return player
    return { ...player, status: 'cut' as const, thru: '', roundScore: '', position: 'CUT' }
  })
}

export function mapCompetitorToPlayer(competitor: any): GolfPlayer {
  const athlete = competitor.athlete || {}
  const name = athlete.displayName || athlete.fullName || competitor.displayName || competitor.name || 'Unknown'
  const split = splitName(name)
  const statusName = String(competitor.status?.type?.name || competitor.status?.type?.description || '').toLowerCase()
  const score = competitor.score?.displayValue ?? competitor.score ?? competitor.displayScore ?? 'E'
  const roundLine = currentRoundLine(competitor.linescores)

  return {
    id: String(athlete.id || competitor.id || name),
    name,
    firstName: athlete.firstName || split.firstName,
    lastName: athlete.lastName || split.lastName,
    score: String(score),
    scoreToPar: parseScoreToPar(score),
    thru: competitor.thru || competitor.statistics?.find?.((s: any) => s.name === 'thru')?.displayValue || thruFromLine(roundLine),
    roundScore: competitor.roundScore || roundLine?.displayValue || '',
    roundScores: roundScoresFromLines(competitor.linescores),
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

async function getCoreEventMetadata(eventId: string) {
  const res = await fetch(`${ESPN_CORE_EVENTS}/${eventId}?lang=en&region=us`, NEXT_REVALIDATE_MEDIUM)
  if (!res.ok) return null
  const event = await res.json()
  const course = event.courses?.find?.((candidate: any) => candidate.host) || event.courses?.[0]

  return {
    event,
    course: course?.name || event.venues?.[0]?.fullName || '',
    location: course?.address?.city || event.venues?.[0]?.address?.city || '',
  }
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
  const cutLinePromise = getProjectedCutLine(eventId)
  const scoreboardRes = await fetch(ESPN_SCOREBOARD, NEXT_NO_STORE)
  if (scoreboardRes.ok) {
    const scoreboard = await scoreboardRes.json()
    const event = (scoreboard.events || []).find((candidate: any) => String(candidate.id) === String(eventId))
    if (event) {
      const competition = event.competitions?.[0]
      const rawPlayers = await enrichPlayersWithTeeTimes(event.id, String(competition?.id || event.id), (competition?.competitors || []).map(mapCompetitorToPlayer))
      const cutLine = await cutLinePromise
      const players = applyOfficialCutStatus(rawPlayers, cutLine)
      const course = event.courses?.find?.((candidate: any) => candidate.host)?.name
        || event.courses?.[0]?.name
        || event.venue?.fullName
        || ''
      const location = event.venue?.address?.city || event.courses?.[0]?.address?.city || ''
      const coreMetadata = course ? null : await getCoreEventMetadata(eventId)

      return {
        id: event.id,
        name: event.name,
        startDate: event.date,
        endDate: event.endDate || event.date,
        course: course || coreMetadata?.course || '',
        location: location || coreMetadata?.location || '',
        status: eventStatus(event),
        round: event.status?.period || competition?.status?.period || 0,
        leaderboard: players,
        cutLine,
      }
    }
  }

  const coreMetadata = await getCoreEventMetadata(eventId)
  if (!coreMetadata) throw new Error(`ESPN event metadata unavailable: ${eventId}`)
  const event = coreMetadata.event
  const competition = event.competitions?.[0]
  const rawPlayers = await enrichPlayersWithTeeTimes(event.id, String(competition?.id || event.id), (competition?.competitors || []).map(mapCompetitorToPlayer))
  const cutLine = await cutLinePromise
  const players = applyOfficialCutStatus(rawPlayers, cutLine)

  return {
    id: event.id,
    name: event.name,
    startDate: event.date,
    endDate: event.endDate || event.date,
    course: coreMetadata.course,
    location: coreMetadata.location,
    status: eventStatus(event),
    round: 0,
    leaderboard: players,
    cutLine,
  }
}
