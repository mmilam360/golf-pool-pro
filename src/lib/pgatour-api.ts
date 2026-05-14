import { gunzipSync } from 'zlib'
import type { GolfPlayer, GolfTournament } from './golf-api'

const PGA_GRAPHQL_URL = 'https://orchestrator.pgatour.com/graphql'
const PGA_REST_URL = 'https://data-api.pgatour.com'
const TOUR_CODE = 'R'
const FETCH_FAST = { next: { revalidate: 60 } } as RequestInit
const FETCH_HOURLY = { next: { revalidate: 3600 } } as RequestInit

interface PgaTourScheduleEvent {
  tournamentId: string
  name: string
  status?: string
  displayDate?: string
  courseData?: {
    name?: string
    city?: string
    stateCode?: string
    country?: string
  }
}

function pgaHeaders(extra: Record<string, string> = {}) {
  const apiKey = process.env.PGA_TOUR_API_KEY
  if (!apiKey) throw new Error('Missing PGA_TOUR_API_KEY')

  return {
    'x-api-key': apiKey,
    'x-pgat-platform': 'web',
    'Origin': 'https://www.pgatour.com',
    'Referer': 'https://www.pgatour.com/',
    'User-Agent': 'Golf Pools Pro scoring sync',
    ...extra,
  }
}

function normalizeName(value: string | null | undefined) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\bthe\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseScoreToPar(score: unknown): number {
  if (score == null || score === '' || score === 'E') return 0
  if (typeof score === 'number') return score
  const parsed = parseInt(String(score).replace('+', ''), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/)
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') }
}

function playerStateToStatus(state: unknown): GolfPlayer['status'] {
  const normalized = String(state || '').toLowerCase()
  if (normalized.includes('cut')) return 'cut'
  if (normalized.includes('wd') || normalized.includes('withdraw')) return 'wd'
  if (normalized.includes('dq') || normalized.includes('dnq')) return 'dnq'
  return 'active'
}

function inflatePayload(payload: string) {
  const raw = Buffer.from(payload, 'base64')
  return JSON.parse(gunzipSync(raw).toString('utf8'))
}

export async function getPgaTourSchedule(season = new Date().getFullYear()) {
  const res = await fetch(`${PGA_REST_URL}/schedule/${TOUR_CODE}/${season}`, {
    ...FETCH_HOURLY,
    headers: pgaHeaders(),
  })

  if (!res.ok) throw new Error(`PGA Tour schedule: ${res.status}`)
  const data = await res.json()
  return (data.tournaments || []) as PgaTourScheduleEvent[]
}

export async function findPgaTourTournamentId({
  name,
  startDate,
  season,
}: {
  name: string
  startDate?: string
  season?: number
}) {
  const targetName = normalizeName(name)
  const targetYear = season || Number(startDate?.slice(0, 4)) || new Date().getFullYear()
  const schedule = await getPgaTourSchedule(targetYear)

  const exact = schedule.find(event => normalizeName(event.name) === targetName)
  if (exact?.tournamentId) return exact.tournamentId

  const loose = schedule.find(event => {
    const candidate = normalizeName(event.name)
    return candidate.includes(targetName) || targetName.includes(candidate)
  })

  return loose?.tournamentId || null
}

function mapPgaTourFieldPlayer(player: any, index: number): GolfPlayer {
  const name = [player.firstName, player.lastName].filter(Boolean).join(' ')
    || String(player.displayName || '').replace(/^([^,]+),\s*(.+)$/, '$2 $1')
    || 'Unknown'
  const split = splitName(name)

  return {
    id: String(player.id || name || `pga-tour-field-${index + 1}`),
    name,
    firstName: player.firstName || split.firstName,
    lastName: player.lastName || split.lastName,
    score: 'E',
    scoreToPar: 0,
    thru: '',
    roundScore: '',
    position: '',
    strokes: 0,
    status: 'active',
    country: player.country || '',
    image: player.headshot || undefined,
  }
}

export async function getPgaTourFieldById(tournamentId: string): Promise<GolfPlayer[]> {
  const query = `query Field($id: ID!) {
    field(id: $id) {
      id
      players {
        id
        displayName
        firstName
        lastName
        country
        headshot
      }
    }
  }`

  const res = await fetch(PGA_GRAPHQL_URL, {
    ...FETCH_HOURLY,
    method: 'POST',
    headers: pgaHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/graphql-response+json, application/json',
    }),
    body: JSON.stringify({
      operationName: 'Field',
      query,
      variables: { id: tournamentId },
    }),
  })

  if (!res.ok) throw new Error(`PGA Tour field: ${res.status}`)
  const data = await res.json()
  const players = data?.data?.field?.players || []
  return players.map(mapPgaTourFieldPlayer).filter((player: GolfPlayer) => player.name && player.name !== 'Unknown')
}

export async function getPgaTourFieldForEvent(event: {
  name: string
  date?: string
  season?: number
}) {
  const tournamentId = await findPgaTourTournamentId({
    name: event.name,
    startDate: event.date,
    season: event.season,
  })

  if (!tournamentId) return []
  return getPgaTourFieldById(tournamentId)
}

export async function getPgaTourLeaderboardById(tournamentId: string): Promise<GolfTournament | null> {
  const query = `query LeaderboardCompressedV3($leaderboardCompressedV3Id: ID!) {
    leaderboardCompressedV3(id: $leaderboardCompressedV3Id) {
      id
      payload
    }
  }`

  const res = await fetch(PGA_GRAPHQL_URL, {
    ...FETCH_FAST,
    method: 'POST',
    headers: pgaHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/graphql-response+json, application/json',
    }),
    body: JSON.stringify({
      operationName: 'LeaderboardCompressedV3',
      query,
      variables: { leaderboardCompressedV3Id: tournamentId },
    }),
  })

  if (!res.ok) throw new Error(`PGA Tour leaderboard: ${res.status}`)
  const data = await res.json()
  const payload = data?.data?.leaderboardCompressedV3?.payload
  if (!payload) return null

  const parsed = inflatePayload(payload)
  const rawPlayers = parsed.players || []
  if (!rawPlayers.length) return null

  const leaderboard: GolfPlayer[] = rawPlayers.map((row: any, index: number) => {
    const player = row.player || {}
    const scoring = row.scoringData || {}
    const name = player.displayName || [player.firstName, player.lastName].filter(Boolean).join(' ') || 'Unknown'
    const split = splitName(name)
    const total = scoring.total ?? 'E'

    return {
      id: String(player.id || row.id || name),
      name,
      firstName: player.firstName || split.firstName,
      lastName: player.lastName || split.lastName,
      score: String(total || 'E'),
      scoreToPar: parseScoreToPar(total),
      thru: String(scoring.thru || scoring.roundStatus || ''),
      roundScore: String(scoring.score || ''),
      position: String(scoring.position || index + 1),
      strokes: Number(scoring.totalStrokes || 0),
      status: playerStateToStatus(scoring.playerState),
      country: player.country || player.countryCode || '',
      image: player.headshot || undefined,
    }
  }).filter(player => player.name && player.name !== 'Unknown')

  return {
    id: tournamentId,
    name: parsed.tournamentName || tournamentId,
    startDate: '',
    endDate: '',
    course: parsed.courseName || '',
    location: '',
    status: 'live',
    round: Number(rawPlayers[0]?.scoringData?.currentRound || 0),
    leaderboard,
  }
}

export async function getPgaTourLeaderboardForEvent(event: {
  name: string
  date?: string
  season?: number
}) {
  const tournamentId = await findPgaTourTournamentId({
    name: event.name,
    startDate: event.date,
    season: event.season,
  })

  if (!tournamentId) return null
  return getPgaTourLeaderboardById(tournamentId)
}
