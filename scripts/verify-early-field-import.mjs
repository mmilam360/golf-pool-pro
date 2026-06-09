import assert from 'node:assert/strict'

const PGA_TOUR_BASE = 'https://www.pgatour.com'
const PGA_TOUR_GRAPHQL = 'https://orchestrator.pgatour.com/graphql'

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\bu\.?\s*s\.?\b/g, 'us')
    .replace(/\b(the|presented by|pres\.? by|challenge|classic|invitational|tournament)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function majorKey(value) {
  const normalized = normalizeName(value)
  if (/\bmasters\b/.test(normalized)) return 'masters'
  if (/\bpga\b/.test(normalized) && /\bchampionship\b/.test(normalized)) return 'pga-championship'
  if (/\bus\b/.test(normalized) && /\bopen\b/.test(normalized)) return 'us-open'
  if (/\bopen\b/.test(normalized) && !/\bus\b/.test(normalized)) return 'open-championship'
  return null
}

function overlapScore(a, b) {
  const leftMajor = majorKey(a)
  const rightMajor = majorKey(b)
  if (leftMajor || rightMajor) return leftMajor && leftMajor === rightMajor ? 1 : 0

  const left = new Set(normalizeName(a).split(' ').filter(Boolean))
  const right = new Set(normalizeName(b).split(' ').filter(Boolean))
  if (!left.size || !right.size) return 0
  return Array.from(left).filter(token => right.has(token)).length / Math.max(left.size, right.size)
}

function easternMonthDay(value) {
  const dateOnly = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
  }).format(parsed)
}

function extractNextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  return match?.[1] ? JSON.parse(match[1]) : null
}

function collectScheduleTournaments(value, output = []) {
  if (Array.isArray(value)) {
    value.forEach(item => collectScheduleTournaments(item, output))
  } else if (value && typeof value === 'object') {
    if (typeof value.tournamentId === 'string' && typeof value.name === 'string' && typeof value.displayDate === 'string') {
      output.push(value)
    }
    Object.values(value).forEach(item => collectScheduleTournaments(item, output))
  }
  return output
}

async function getPgaTourSchedule(season) {
  const res = await fetch(`${PGA_TOUR_BASE}/schedule/${season}`, {
    headers: { 'user-agent': 'Mozilla/5.0 GolfPoolsPro/1.0' },
  })
  assert.equal(res.ok, true, `PGA Tour schedule returned ${res.status}`)
  return collectScheduleTournaments(extractNextData(await res.text()))
    .filter((tournament, index, all) => tournament.tournamentId && all.findIndex(candidate => candidate.tournamentId === tournament.tournamentId) === index)
}

function findPgaTourTournament({ pgaSchedule, eventName, startDate }) {
  const dateLabel = easternMonthDay(startDate).toLowerCase()
  const candidates = pgaSchedule
    .filter(tournament => String(tournament.displayDate || '').toLowerCase().includes(dateLabel))
    .map(tournament => ({ tournament, score: overlapScore(eventName, tournament.name || '') }))
    .sort((a, b) => b.score - a.score)

  return candidates.find(candidate => candidate.score >= 0.35)?.tournament || null
}

async function getPgaTourApiKey() {
  const scheduleRes = await fetch(`${PGA_TOUR_BASE}/schedule`, {
    headers: { 'user-agent': 'Mozilla/5.0 GolfPoolsPro/1.0' },
  })
  assert.equal(scheduleRes.ok, true, `PGA Tour schedule page returned ${scheduleRes.status}`)
  const html = await scheduleRes.text()
  const appScript = html.match(/<script[^>]+src="([^"]*\/pages\/_app-[^"]+\.js)"/)?.[1]
  assert.ok(appScript, 'expected PGA Tour app script')

  const scriptUrl = appScript.startsWith('http') ? appScript : `${PGA_TOUR_BASE}${appScript}`
  const scriptRes = await fetch(scriptUrl, {
    headers: { 'user-agent': 'Mozilla/5.0 GolfPoolsPro/1.0' },
  })
  assert.equal(scriptRes.ok, true, `PGA Tour app script returned ${scriptRes.status}`)
  const script = await scriptRes.text()
  const apiKey = script.match(/"apiKey"\s*:\s*"([^"]+)"[\s\S]{0,300}?"queryEndpoint"\s*:\s*"https:\/\/orchestrator\.pgatour\.com\/graphql"/)?.[1]
  assert.ok(apiKey, 'expected PGA Tour GraphQL API key')
  return apiKey
}

function displayNameForPlayer(player) {
  const firstLast = [player.firstName, player.lastName].filter(Boolean).join(' ').trim()
  if (firstLast) return firstLast
  const display = player.displayName || player.shortName || ''
  const lastFirst = display.match(/^([^,]+),\s*(.+)$/)
  if (lastFirst) return `${lastFirst[2]} ${lastFirst[1]}`.trim()
  return display
}

async function getPgaTourField(tournamentId) {
  const res = await fetch(PGA_TOUR_GRAPHQL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': await getPgaTourApiKey(),
      'user-agent': 'Mozilla/5.0 GolfPoolsPro/1.0',
    },
    body: JSON.stringify({
      operationName: 'Field',
      variables: { fieldId: tournamentId, includeWithdrawn: true, changesOnly: false },
      query: `query Field($fieldId: ID!, $includeWithdrawn: Boolean, $changesOnly: Boolean) {
        field(id: $fieldId, includeWithdrawn: $includeWithdrawn, changesOnly: $changesOnly) {
          players { id firstName lastName shortName displayName withdrawn status }
        }
      }`,
    }),
  })
  assert.equal(res.ok, true, `PGA Tour field ${tournamentId} returned ${res.status}`)
  const data = await res.json()
  return (data?.data?.field?.players || [])
    .map(player => ({
      id: String(player.id || ''),
      name: displayNameForPlayer(player),
      score: 'E',
      status: player.withdrawn || String(player.status || '').toLowerCase().includes('withdraw') ? 'wd' : 'active',
    }))
    .filter(player => player.id && player.name)
}

const schedule = await getPgaTourSchedule(2026)
const cjCup = findPgaTourTournament({
  pgaSchedule: schedule,
  eventName: 'THE CJ CUP Byron Nelson',
  startDate: '2026-05-21T04:00Z',
})

assert.equal(cjCup?.tournamentId, 'R2026019')

const field = await getPgaTourField(cjCup.tournamentId)
assert.ok(field.length > 100, `expected early CJ Cup field, got ${field.length}`)
assert.ok(field[0]?.name && !field[0].name.includes(','), 'field names should be normalized as First Last')
assert.equal(field[0]?.score, 'E')
assert.equal(field[0]?.status === 'active' || field[0]?.status === 'wd', true)

const usOpen = findPgaTourTournament({
  pgaSchedule: schedule,
  eventName: 'U.S. Open',
  startDate: '2026-06-18',
})

assert.equal(usOpen?.tournamentId, 'R2026026')
const usOpenField = await getPgaTourField(usOpen.tournamentId)
const usOpenNames = new Set(usOpenField.map(player => player.name))
assert.ok(usOpenField.length >= 140, `expected official U.S. Open field, got ${usOpenField.length}`)
for (const name of ['Scottie Scheffler', 'Rory McIlroy', 'Bryson DeChambeau', 'Jon Rahm']) {
  assert.ok(usOpenNames.has(name), `expected U.S. Open field to include ${name}`)
}

console.log(`early PGA TOUR field checks passed (CJ Cup ${field.length}, U.S. Open ${usOpenField.length})`)
