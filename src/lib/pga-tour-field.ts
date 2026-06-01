import type { GolfPlayer } from './golf-api'
import { hydrateFieldWithOwgr } from './owgr'

const PGA_TOUR_BASE = 'https://www.pgatour.com'
const PGA_TOUR_GRAPHQL = 'https://orchestrator.pgatour.com/graphql'

const NEXT_REVALIDATE_HOURLY = { next: { revalidate: 3600 } } as RequestInit
const NEXT_REVALIDATE_DAILY = { next: { revalidate: 86400 } } as RequestInit

const FIELD_QUERY = `query Field($fieldId: ID!, $includeWithdrawn: Boolean, $changesOnly: Boolean) {
  field(id: $fieldId, includeWithdrawn: $includeWithdrawn, changesOnly: $changesOnly) {
    tournamentName
    id
    lastUpdated
    players {
      id
      firstName
      lastName
      shortName
      displayName
      amateur
      country
      countryFlag
      headshot
      qualifier
      alternate
      withdrawn
      status
      owgr
      rankingPoints
    }
  }
}`

type PgaScheduleTournament = {
  tournamentId?: string
  name?: string
  displayDate?: string
  display?: string
  status?: string
  courseData?: {
    name?: string
    city?: string
    stateCode?: string
  }
}

type PgaFieldPlayer = {
  id?: string
  firstName?: string
  lastName?: string
  shortName?: string
  displayName?: string
  amateur?: boolean
  country?: string
  countryFlag?: string
  headshot?: string
  qualifier?: boolean
  alternate?: boolean
  withdrawn?: boolean
  status?: string
  owgr?: string | number | null
  rankingPoints?: string | number | null
}

let cachedApiKey: string | null = null
const cachedScheduleBySeason = new Map<number, PgaScheduleTournament[]>()

function normalizeName(value: string | null | undefined) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\bu\.?\s*s\.?\b/g, 'us')
    .replace(/\b(the|presented by|pres\.? by|challenge|classic|invitational|tournament)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function majorKey(value: string | null | undefined) {
  const normalized = normalizeName(value)
  if (/\bmasters\b/.test(normalized)) return 'masters'
  if (/\bpga\b/.test(normalized) && /\bchampionship\b/.test(normalized)) return 'pga-championship'
  if (/\bus\b/.test(normalized) && /\bopen\b/.test(normalized)) return 'us-open'
  if (/\bopen\b/.test(normalized) && !/\bus\b/.test(normalized)) return 'open-championship'
  return null
}

function overlapScore(a: string, b: string) {
  const leftMajor = majorKey(a)
  const rightMajor = majorKey(b)
  if (leftMajor || rightMajor) return leftMajor && leftMajor === rightMajor ? 1 : 0

  const left = new Set(normalizeName(a).split(' ').filter(Boolean))
  const right = new Set(normalizeName(b).split(' ').filter(Boolean))
  if (!left.size || !right.size) return 0
  return Array.from(left).filter(token => right.has(token)).length / Math.max(left.size, right.size)
}

function easternMonthDay(value: string | null | undefined) {
  if (!value) return ''
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value)
  if (!Number.isFinite(parsed.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
  }).format(parsed)
}

function scheduleDateMatches(displayDate: string | undefined, startDate: string | null | undefined) {
  if (!displayDate || !startDate) return false
  return displayDate.toLowerCase().includes(easternMonthDay(startDate).toLowerCase())
}

function extractNextData(html: string) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match?.[1]) return null
  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

function collectScheduleTournaments(value: unknown, output: PgaScheduleTournament[] = []) {
  if (Array.isArray(value)) {
    value.forEach(item => collectScheduleTournaments(item, output))
  } else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.tournamentId === 'string' && typeof record.name === 'string' && typeof record.displayDate === 'string') {
      output.push(record as PgaScheduleTournament)
    }
    Object.values(record).forEach(item => collectScheduleTournaments(item, output))
  }
  return output
}

async function getPgaTourApiKey() {
  if (cachedApiKey) return cachedApiKey

  const scheduleRes = await fetch(`${PGA_TOUR_BASE}/schedule`, {
    headers: { 'user-agent': 'Mozilla/5.0 GolfPoolsPro/1.0' },
    ...NEXT_REVALIDATE_DAILY,
  })
  if (!scheduleRes.ok) return null

  const html = await scheduleRes.text()
  const appScript = html.match(/<script[^>]+src="([^"]*\/pages\/_app-[^"]+\.js)"/)?.[1]
  if (!appScript) return null

  const scriptUrl = appScript.startsWith('http') ? appScript : `${PGA_TOUR_BASE}${appScript}`
  const scriptRes = await fetch(scriptUrl, {
    headers: { 'user-agent': 'Mozilla/5.0 GolfPoolsPro/1.0' },
    ...NEXT_REVALIDATE_DAILY,
  })
  if (!scriptRes.ok) return null

  const script = await scriptRes.text()
  cachedApiKey = script.match(/"apiKey"\s*:\s*"([^"]+)"[\s\S]{0,300}?"queryEndpoint"\s*:\s*"https:\/\/orchestrator\.pgatour\.com\/graphql"/)?.[1] || null
  return cachedApiKey
}

export async function getPgaTourSchedule(season: number) {
  const cached = cachedScheduleBySeason.get(season)
  if (cached) return cached

  const res = await fetch(`${PGA_TOUR_BASE}/schedule/${season}`, {
    headers: { 'user-agent': 'Mozilla/5.0 GolfPoolsPro/1.0' },
    ...NEXT_REVALIDATE_DAILY,
  })
  if (!res.ok) return []

  const data = extractNextData(await res.text())
  const tournaments = collectScheduleTournaments(data)
    .filter((tournament, index, all) => tournament.tournamentId && all.findIndex(candidate => candidate.tournamentId === tournament.tournamentId) === index)
  cachedScheduleBySeason.set(season, tournaments)
  return tournaments
}

export function findPgaTourTournament(args: {
  pgaSchedule: PgaScheduleTournament[]
  eventName: string
  startDate: string | null | undefined
}) {
  const candidates = args.pgaSchedule
    .filter(tournament => scheduleDateMatches(tournament.displayDate, args.startDate))
    .map(tournament => ({ tournament, score: overlapScore(args.eventName, tournament.name || '') }))
    .sort((a, b) => b.score - a.score)

  return candidates.find(candidate => candidate.score >= 0.35)?.tournament || null
}

function displayNameForPlayer(player: PgaFieldPlayer) {
  const firstLast = [player.firstName, player.lastName].filter(Boolean).join(' ').trim()
  if (firstLast) return firstLast
  const display = player.displayName || player.shortName || ''
  const lastFirst = display.match(/^([^,]+),\s*(.+)$/)
  if (lastFirst) return `${lastFirst[2]} ${lastFirst[1]}`.trim()
  return display
}

function toNullableNumber(value: string | number | null | undefined) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeLastUpdated(value: string | number | null | undefined) {
  if (value == null || value === '') return null
  const numeric = Number(value)
  const parsed = Number.isFinite(numeric) ? new Date(numeric) : new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null
}

function mapPgaFieldPlayer(player: PgaFieldPlayer): GolfPlayer | null {
  const name = displayNameForPlayer(player)
  if (!player.id || !name) return null
  const status = String(player.status || '').toLowerCase()
  return {
    id: String(player.id),
    name,
    firstName: player.firstName || name.split(/\s+/)[0] || '',
    lastName: player.lastName || name.split(/\s+/).slice(1).join(' '),
    score: 'E',
    scoreToPar: 0,
    thru: '',
    roundScore: '',
    position: '',
    strokes: 0,
    status: player.withdrawn || status.includes('withdraw') || status === 'wd' ? 'wd' : 'active',
    country: player.country || player.countryFlag || '',
    image: player.headshot,
    owgr: toNullableNumber(player.owgr),
    rankingPoints: toNullableNumber(player.rankingPoints),
  }
}

export async function getPgaTourFieldWithMeta(tournamentId: string): Promise<{ players: GolfPlayer[]; lastUpdated: string | null }> {
  const apiKey = await getPgaTourApiKey()
  if (!apiKey) return { players: [], lastUpdated: null }

  const res = await fetch(PGA_TOUR_GRAPHQL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'user-agent': 'Mozilla/5.0 GolfPoolsPro/1.0',
    },
    body: JSON.stringify({
      operationName: 'Field',
      variables: { fieldId: tournamentId, includeWithdrawn: true, changesOnly: false },
      query: FIELD_QUERY,
    }),
    ...NEXT_REVALIDATE_HOURLY,
  })
  if (!res.ok) return { players: [], lastUpdated: null }

  const data = await res.json().catch(() => null)
  const field = data?.data?.field
  const players = field?.players
  if (!Array.isArray(players)) return { players: [], lastUpdated: null }
  const mapped = players.map(mapPgaFieldPlayer).filter(Boolean) as GolfPlayer[]
  const hydrated = await hydrateFieldWithOwgr(mapped)
  return { players: hydrated, lastUpdated: normalizeLastUpdated(field?.lastUpdated) }
}

export async function getPgaTourField(tournamentId: string): Promise<GolfPlayer[]> {
  const meta = await getPgaTourFieldWithMeta(tournamentId)
  return meta.players
}
