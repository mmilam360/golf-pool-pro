import type { GolfPlayer } from './golf-api'

export const THE_ODDS_API_SOURCE = 'the_odds_api' as const
export const THE_ODDS_API_MARKET = 'outrights' as const
export const THE_ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4'

export const THE_ODDS_API_MAJOR_SPORT_KEYS = {
  masters: 'golf_masters_tournament_winner',
  pgaChampionship: 'golf_pga_championship_winner',
  theOpen: 'golf_the_open_championship_winner',
  usOpen: 'golf_us_open_winner',
} as const

const DEFAULT_MIN_FIELD_COVERAGE = 0.75
const DEFAULT_MARKET_MAX_AGE_HOURS = 72
const ACTUAL_MAJOR_FIELD_SIZE_FLOOR = 40
const ACTUAL_MAJOR_TOP_OWGR_COHORT = 20
const FIXTURE_TOP_OWGR_COHORT = 3

const RANK_KEYS = [
  'owgrRank',
  'owgr_rank',
  'worldRank',
  'world_rank',
  'worldGolfRank',
  'world_golf_rank',
  'rank',
  'ranking',
  'owgr',
]

export type TheOddsApiOutcome = {
  name?: string | null
  price?: number | string | null
}

export type TheOddsApiMarket = {
  key?: string | null
  last_update?: string | null
  outcomes?: TheOddsApiOutcome[] | null
}

export type TheOddsApiBookmaker = {
  key?: string | null
  title?: string | null
  last_update?: string | null
  markets?: TheOddsApiMarket[] | null
}

export type TheOddsApiEvent = {
  id?: string | null
  sport_key?: string | null
  sport_title?: string | null
  commence_time?: string | null
  home_team?: string | null
  away_team?: string | null
  bookmakers?: TheOddsApiBookmaker[] | null
}

export type TournamentOdd = {
  playerId: string | null
  playerName: string
  americanOdds: number | null
  decimalOdds: number | null
  impliedProbability: number
  consensusProbability: number
  books: string[]
  source: typeof THE_ODDS_API_SOURCE
  capturedAt: string
}

export type TournamentOddsQuality = {
  ok: boolean
  reason: string
  fieldPlayers: number
  matchedPlayers: number
  quotedPlayers: number
  coverage: number
  bookCount: number
  topOwgrRequired: number
  topOwgrCovered: number
  unmatchedOutcomes: string[]
  duplicateMatches: string[]
}

export type TournamentOddsSnapshot = {
  status: 'ok' | 'fallback'
  fallbackReason: string | null
  source: typeof THE_ODDS_API_SOURCE
  sourceSportKey: string | null
  marketKey: typeof THE_ODDS_API_MARKET
  eventId: string | null
  eventName: string | null
  sportTitle: string | null
  tournamentName: string | null
  tournamentStartDate: string | null
  capturedAt: string
  fieldFingerprint: string
  quality: TournamentOddsQuality
  odds: TournamentOdd[]
}

type FieldLike = Partial<GolfPlayer> & Record<string, unknown>

type FieldEntry = {
  id: string
  name: string
  normalizedName: string
  owgrRank: number | null
  player: FieldLike
}

type MatchedQuote = {
  player: FieldEntry
  outcomeName: string
  americanOdds: number
  decimalOdds: number
  rawProbability: number
  normalizedProbability: number
  bookKey: string
}

type ProcessedBook = {
  key: string
  quotes: MatchedQuote[]
  matchedIds: Set<string>
  unmatchedOutcomes: string[]
}

export const DEFAULT_GOLFER_NAME_ALIASES: Record<string, string> = {
  'Bob MacIntyre': 'Robert MacIntyre',
  'Robert McIntyre': 'Robert MacIntyre',
  'Tom Kim': 'Tom Kim',
  'Joohyung Kim': 'Tom Kim',
  'Ben An': 'Byeong Hun An',
  'B.H. An': 'Byeong Hun An',
  'Byeong-Hun An': 'Byeong Hun An',
  'Alex Noren': 'Alexander Noren',
  'Mito Pereira': 'Guillermo Pereira',
  'J.J. Spaun': 'JJ Spaun',
  'J.T. Poston': 'JT Poston',
  'C.T. Pan': 'CT Pan',
  'K.H. Lee': 'Kyoung-Hoon Lee',
  'Kyoung Hoon Lee': 'Kyoung-Hoon Lee',
  'S.H. Kim': 'Seonghyeon Kim',
  'Sung Jae Im': 'Sungjae Im',
  'Siwoo Kim': 'Si Woo Kim',
  'Thorbjørn Olesen': 'Thorbjorn Olesen',
  'Nicolai Højgaard': 'Nicolai Hojgaard',
  'Rasmus Højgaard': 'Rasmus Hojgaard',
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/[^0-9.+-]/g, ''))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function normalizePositiveInt(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(String(value || '').replace(/[^0-9]/g, ''))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function readOwgrRank(player: FieldLike): number | null {
  for (const key of RANK_KEYS) {
    const rank = normalizePositiveInt(player[key])
    if (rank !== null) return rank
  }
  return null
}

function nameFromPlayer(player: FieldLike, index: number) {
  const explicit = typeof player.name === 'string' ? player.name.trim() : ''
  const composed = [player.firstName, player.lastName]
    .filter(part => typeof part === 'string' && part.trim())
    .join(' ')
    .trim()
  return explicit || composed || `Golfer ${index + 1}`
}

function idFromPlayer(player: FieldLike, name: string, index: number) {
  const id = player.id ?? player.playerId ?? player.espnId ?? player.pgaTourId
  return String(id || name || index)
}

function stripDiacritics(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalizeTournamentName(value: string) {
  return normalizeGolfName(value)
    .replace(/\bu s\b/g, 'us')
    .replace(/\bu\.s\./g, 'us')
}

export function normalizeGolfName(value: unknown): string {
  let normalized = stripDiacritics(String(value || '').trim().toLowerCase())
  if (!normalized) return ''

  const commaParts = normalized.split(',').map(part => part.trim()).filter(Boolean)
  if (commaParts.length === 2) {
    normalized = `${commaParts[1]} ${commaParts[0]}`
  }

  normalized = normalized
    .replace(/\b([a-z])\.\s*([a-z])\./g, '$1$2')
    .replace(/[’'`]/g, '')
    .replace(/[._/\\-]/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized
}

export function selectTheOddsApiSportKey(tournamentName: unknown): string | null {
  const normalized = normalizeTournamentName(String(tournamentName || ''))
  if (!normalized) return null

  if (
    normalized === 'masters' ||
    normalized === 'the masters' ||
    normalized.includes('masters tournament')
  ) {
    return THE_ODDS_API_MAJOR_SPORT_KEYS.masters
  }

  if (normalized === 'pga championship' || normalized.startsWith('pga championship ')) {
    return THE_ODDS_API_MAJOR_SPORT_KEYS.pgaChampionship
  }

  if (normalized === 'us open' || normalized.includes('us open championship') || /\bus open\b/.test(normalized)) {
    return THE_ODDS_API_MAJOR_SPORT_KEYS.usOpen
  }

  if (
    normalized === 'the open' ||
    normalized === 'open championship' ||
    normalized === 'the open championship' ||
    normalized.startsWith('the open championship ')
  ) {
    return THE_ODDS_API_MAJOR_SPORT_KEYS.theOpen
  }

  return null
}

export function americanOddsToImpliedProbability(odds: number): number {
  if (!Number.isFinite(odds) || odds === 0) return Number.NaN
  if (odds > 0) return 100 / (odds + 100)
  const absolute = Math.abs(odds)
  return absolute / (absolute + 100)
}

export function americanOddsToDecimal(odds: number): number {
  if (!Number.isFinite(odds) || odds === 0) return Number.NaN
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds)
}

export function decimalOddsToAmerican(decimalOdds: number): number | null {
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) return null
  const american = decimalOdds >= 2
    ? Math.round((decimalOdds - 1) * 100)
    : Math.round(-100 / (decimalOdds - 1))
  return Object.is(american, -0) ? 0 : american
}

function median(values: number[]): number | null {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (sorted.length === 0) return null
  const midpoint = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[midpoint]
  return (sorted[midpoint - 1] + sorted[midpoint]) / 2
}

function safeIso(value: unknown, fallback = new Date().toISOString()) {
  if (typeof value !== 'string' || !value.trim()) return fallback
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : fallback
}

function dateOnly(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value.slice(0, 10) || null
  return date.toISOString().slice(0, 10)
}

function daysBetween(left: string | null, right: string | null) {
  if (!left || !right) return 0
  const leftMs = new Date(`${left}T00:00:00.000Z`).getTime()
  const rightMs = new Date(`${right}T00:00:00.000Z`).getTime()
  if (!Number.isFinite(leftMs) || !Number.isFinite(rightMs)) return 0
  return Math.abs(leftMs - rightMs) / 86_400_000
}

export function oddsFieldFingerprint(field: FieldLike[]): string {
  return (Array.isArray(field) ? field : [])
    .filter(player => String(player?.status || '').toLowerCase() !== 'wd')
    .map((player, index) => normalizeGolfName(nameFromPlayer(player, index)))
    .filter(Boolean)
    .sort()
    .join('|')
}

function normalizedAliasMap(aliases: Record<string, string> = DEFAULT_GOLFER_NAME_ALIASES) {
  const map = new Map<string, string>()
  for (const [alias, canonical] of Object.entries(aliases)) {
    const aliasKey = normalizeGolfName(alias)
    const canonicalKey = normalizeGolfName(canonical)
    if (aliasKey && canonicalKey) map.set(aliasKey, canonicalKey)
  }
  return map
}

function uniqueEntries(entries: FieldEntry[]) {
  const seen = new Set<string>()
  const unique: FieldEntry[] = []
  for (const entry of entries) {
    if (seen.has(entry.id)) continue
    seen.add(entry.id)
    unique.push(entry)
  }
  return unique
}

function buildFieldIndex(field: FieldLike[], aliases?: Record<string, string>) {
  const aliasMap = normalizedAliasMap(aliases)
  const entries = (Array.isArray(field) ? field : [])
    .filter(player => String(player?.status || '').toLowerCase() !== 'wd')
    .map((player, index) => {
      const name = nameFromPlayer(player, index)
      const normalizedName = normalizeGolfName(name)
      return {
        id: idFromPlayer(player, name, index),
        name,
        normalizedName: aliasMap.get(normalizedName) || normalizedName,
        owgrRank: readOwgrRank(player),
        player,
      }
    })
    .filter(entry => entry.normalizedName)

  const keyToEntries = new Map<string, FieldEntry[]>()
  const add = (key: string, entry: FieldEntry) => {
    if (!key) return
    keyToEntries.set(key, [...(keyToEntries.get(key) || []), entry])
  }

  for (const entry of entries) add(entry.normalizedName, entry)

  for (const [aliasKey, canonicalKey] of aliasMap.entries()) {
    for (const entry of entries) {
      if (entry.normalizedName === canonicalKey) add(aliasKey, entry)
    }
  }

  const duplicateKeys = new Set<string>()
  for (const [key, values] of keyToEntries.entries()) {
    if (uniqueEntries(values).length > 1) duplicateKeys.add(key)
  }

  return { entries, keyToEntries, aliasMap, duplicateKeys }
}

function matchOutcomeToField(
  outcomeName: string,
  index: ReturnType<typeof buildFieldIndex>
): { entry: FieldEntry | null; duplicate: string | null } {
  const normalized = normalizeGolfName(outcomeName)
  const canonical = index.aliasMap.get(normalized) || normalized
  if (index.duplicateKeys.has(canonical) || index.duplicateKeys.has(normalized)) {
    return { entry: null, duplicate: outcomeName }
  }

  const direct = uniqueEntries(index.keyToEntries.get(canonical) || index.keyToEntries.get(normalized) || [])
  if (direct.length > 1) return { entry: null, duplicate: outcomeName }
  return { entry: direct[0] || null, duplicate: null }
}

function baseQuality(overrides: Partial<TournamentOddsQuality> = {}): TournamentOddsQuality {
  return {
    ok: false,
    reason: 'not_evaluated',
    fieldPlayers: 0,
    matchedPlayers: 0,
    quotedPlayers: 0,
    coverage: 0,
    bookCount: 0,
    topOwgrRequired: 0,
    topOwgrCovered: 0,
    unmatchedOutcomes: [],
    duplicateMatches: [],
    ...overrides,
  }
}

function fallbackSnapshot(input: {
  reason: string
  sourceSportKey: string | null
  tournamentName?: string | null
  tournamentStartDate?: string | null
  capturedAt: string
  fieldFingerprint: string
  event?: TheOddsApiEvent | null
  quality?: Partial<TournamentOddsQuality>
}): TournamentOddsSnapshot {
  return {
    status: 'fallback',
    fallbackReason: input.reason,
    source: THE_ODDS_API_SOURCE,
    sourceSportKey: input.sourceSportKey,
    marketKey: THE_ODDS_API_MARKET,
    eventId: input.event?.id || null,
    eventName: input.event?.home_team || input.event?.away_team || input.event?.sport_title || null,
    sportTitle: input.event?.sport_title || null,
    tournamentName: input.tournamentName || null,
    tournamentStartDate: input.tournamentStartDate || null,
    capturedAt: input.capturedAt,
    fieldFingerprint: input.fieldFingerprint,
    quality: baseQuality({ reason: input.reason, ...(input.quality || {}) }),
    odds: [],
  }
}

function eventMatchesTournament(event: TheOddsApiEvent, sportKey: string, tournamentStartDate?: string | null) {
  if (event.sport_key !== sportKey) return false
  const expectedDate = dateOnly(tournamentStartDate || null)
  const eventDate = dateOnly(event.commence_time || null)
  if (expectedDate && eventDate && daysBetween(expectedDate, eventDate) > 7) return false
  return true
}

function findOutrightMarket(bookmaker: TheOddsApiBookmaker): TheOddsApiMarket | null {
  return (bookmaker.markets || []).find(market => market?.key === THE_ODDS_API_MARKET) || null
}

function hoursOld(value: string | null | undefined, nowIso: string) {
  if (!value) return Number.POSITIVE_INFINITY
  const timestamp = new Date(value).getTime()
  const now = new Date(nowIso).getTime()
  if (!Number.isFinite(timestamp) || !Number.isFinite(now)) return Number.POSITIVE_INFINITY
  return (now - timestamp) / 3_600_000
}

function processBookmakerMarket({
  bookmaker,
  fieldIndex,
}: {
  bookmaker: TheOddsApiBookmaker
  fieldIndex: ReturnType<typeof buildFieldIndex>
}): { book: ProcessedBook | null; duplicateMatches: string[] } {
  const market = findOutrightMarket(bookmaker)
  const outcomes = Array.isArray(market?.outcomes) ? market?.outcomes || [] : []
  if (outcomes.length === 0) return { book: null, duplicateMatches: [] }

  const bookKey = bookmaker.key || bookmaker.title || 'bookmaker'
  const rawQuotes: Array<Omit<MatchedQuote, 'normalizedProbability' | 'bookKey'> & { bookKey?: string }> = []
  const unmatchedOutcomes: string[] = []
  const duplicateMatches: string[] = []
  const seenFieldIds = new Set<string>()
  let totalRawProbability = 0

  for (const outcome of outcomes) {
    const outcomeName = typeof outcome?.name === 'string' ? outcome.name.trim() : ''
    const price = finiteNumber(outcome?.price)
    if (!outcomeName || price === null) continue

    const rawProbability = americanOddsToImpliedProbability(price)
    const decimalOdds = americanOddsToDecimal(price)
    if (!Number.isFinite(rawProbability) || rawProbability <= 0 || !Number.isFinite(decimalOdds) || decimalOdds <= 1) continue

    totalRawProbability += rawProbability
    const match = matchOutcomeToField(outcomeName, fieldIndex)
    if (match.duplicate) {
      duplicateMatches.push(match.duplicate)
      continue
    }
    if (!match.entry) {
      unmatchedOutcomes.push(outcomeName)
      continue
    }
    if (seenFieldIds.has(match.entry.id)) {
      duplicateMatches.push(outcomeName)
      continue
    }
    seenFieldIds.add(match.entry.id)
    rawQuotes.push({
      player: match.entry,
      outcomeName,
      americanOdds: price,
      decimalOdds,
      rawProbability,
    })
  }

  if (duplicateMatches.length > 0) return { book: null, duplicateMatches }
  if (totalRawProbability <= 0 || rawQuotes.length === 0) return { book: null, duplicateMatches: [] }

  const quotes = rawQuotes.map(quote => ({
    ...quote,
    bookKey,
    normalizedProbability: quote.rawProbability / totalRawProbability,
  }))

  return {
    duplicateMatches: [],
    book: {
      key: bookKey,
      quotes,
      matchedIds: new Set(quotes.map(quote => quote.player.id)),
      unmatchedOutcomes,
    },
  }
}

function topOwgrEntries(entries: FieldEntry[], explicitSize?: number) {
  const ranked = entries
    .filter(entry => entry.owgrRank !== null)
    .sort((a, b) => (a.owgrRank || 9999) - (b.owgrRank || 9999) || a.name.localeCompare(b.name))
  const size = explicitSize ?? (entries.length >= ACTUAL_MAJOR_FIELD_SIZE_FLOOR
    ? ACTUAL_MAJOR_TOP_OWGR_COHORT
    : Math.min(FIXTURE_TOP_OWGR_COHORT, ranked.length))
  return ranked.slice(0, Math.max(0, size))
}

function countCovered(ids: Set<string>, entries: FieldEntry[]) {
  return entries.filter(entry => ids.has(entry.id)).length
}

function formatCoverageReason(prefix: string, coverage: number, required: number) {
  return `${prefix}(${coverage.toFixed(3)}<${required})`
}

export function buildTournamentOddsSnapshot({
  tournamentName,
  tournamentStartDate,
  field,
  events,
  capturedAt,
  now,
  minCoverage = DEFAULT_MIN_FIELD_COVERAGE,
  marketMaxAgeHours = DEFAULT_MARKET_MAX_AGE_HOURS,
  topOwgrCohortSize,
  aliases,
}: {
  tournamentName: string
  tournamentStartDate?: string | null
  field: FieldLike[]
  events: TheOddsApiEvent[]
  capturedAt?: string
  now?: string | Date
  minCoverage?: number
  marketMaxAgeHours?: number
  topOwgrCohortSize?: number
  aliases?: Record<string, string>
}): TournamentOddsSnapshot {
  const capturedAtIso = safeIso(capturedAt, new Date().toISOString())
  const nowIso = now instanceof Date ? now.toISOString() : safeIso(now || capturedAtIso, capturedAtIso)
  const sourceSportKey = selectTheOddsApiSportKey(tournamentName)
  const fieldFingerprint = oddsFieldFingerprint(field)
  const fieldIndex = buildFieldIndex(field, aliases)
  const fieldPlayers = fieldIndex.entries.length
  const topEntries = topOwgrEntries(fieldIndex.entries, topOwgrCohortSize)

  const fallback = (reason: string, event?: TheOddsApiEvent | null, quality: Partial<TournamentOddsQuality> = {}) => fallbackSnapshot({
    reason,
    sourceSportKey,
    tournamentName,
    tournamentStartDate: tournamentStartDate || null,
    capturedAt: capturedAtIso,
    fieldFingerprint,
    event: event || null,
    quality: {
      fieldPlayers,
      topOwgrRequired: topEntries.length,
      ...quality,
    },
  })

  if (!sourceSportKey) return fallback('unsupported_tournament')
  if (!Array.isArray(events) || events.length === 0) return fallback('no_events')

  const matchingEvents = events.filter(event => eventMatchesTournament(event, sourceSportKey, tournamentStartDate))
  const event = matchingEvents[0]
  if (!event) return fallback('event_mismatch')

  if (fieldPlayers === 0) return fallback('empty_field', event)

  const duplicateFieldKeys = Array.from(fieldIndex.duplicateKeys)
  if (duplicateFieldKeys.length > 0) {
    return fallback('duplicate_field_names', event, { duplicateMatches: duplicateFieldKeys })
  }

  const bookmakers = Array.isArray(event.bookmakers) ? event.bookmakers : []
  if (bookmakers.length === 0) return fallback('no_bookmakers', event)

  const usableBooks: ProcessedBook[] = []
  const allUnmatched = new Set<string>()
  const duplicateMatches = new Set<string>()
  let staleBooks = 0
  let missingMarketBooks = 0
  let incompleteBooks = 0

  for (const bookmaker of bookmakers) {
    const market = findOutrightMarket(bookmaker)
    if (!market) {
      missingMarketBooks++
      continue
    }
    const ageHours = hoursOld(market.last_update || bookmaker.last_update, nowIso)
    if (ageHours > marketMaxAgeHours) {
      staleBooks++
      continue
    }

    const processed = processBookmakerMarket({ bookmaker, fieldIndex })
    for (const duplicate of processed.duplicateMatches) duplicateMatches.add(duplicate)
    if (processed.duplicateMatches.length > 0) continue
    if (!processed.book) {
      incompleteBooks++
      continue
    }

    for (const unmatched of processed.book.unmatchedOutcomes) allUnmatched.add(unmatched)
    const coverage = processed.book.matchedIds.size / fieldPlayers
    const topCovered = countCovered(processed.book.matchedIds, topEntries)
    if (coverage < minCoverage || topCovered < topEntries.length) {
      incompleteBooks++
      continue
    }

    usableBooks.push(processed.book)
  }

  if (duplicateMatches.size > 0) {
    return fallback('duplicate_provider_participant', event, {
      duplicateMatches: Array.from(duplicateMatches).sort(),
      unmatchedOutcomes: Array.from(allUnmatched).sort(),
      bookCount: usableBooks.length,
    })
  }

  if (usableBooks.length === 0) {
    const reason = staleBooks > 0 && staleBooks >= bookmakers.length
      ? 'stale_market'
      : `no_usable_bookmakers(stale=${staleBooks},missing_market=${missingMarketBooks},incomplete=${incompleteBooks})`
    return fallback(reason, event, {
      unmatchedOutcomes: Array.from(allUnmatched).sort(),
      bookCount: 0,
    })
  }

  const unionMatchedIds = new Set<string>()
  const quotesByPlayer = new Map<string, MatchedQuote[]>()
  for (const book of usableBooks) {
    for (const quote of book.quotes) {
      unionMatchedIds.add(quote.player.id)
      quotesByPlayer.set(quote.player.id, [...(quotesByPlayer.get(quote.player.id) || []), quote])
    }
  }

  const coverage = unionMatchedIds.size / fieldPlayers
  const topCovered = countCovered(unionMatchedIds, topEntries)
  const qualityBase = {
    fieldPlayers,
    matchedPlayers: unionMatchedIds.size,
    quotedPlayers: unionMatchedIds.size,
    coverage,
    bookCount: usableBooks.length,
    topOwgrRequired: topEntries.length,
    topOwgrCovered: topCovered,
    unmatchedOutcomes: Array.from(allUnmatched).sort(),
    duplicateMatches: [],
  }

  if (coverage < minCoverage) {
    return fallback(formatCoverageReason('low_coverage', coverage, minCoverage), event, qualityBase)
  }
  if (topCovered < topEntries.length) {
    return fallback(`missing_top_owgr(${topCovered}<${topEntries.length})`, event, qualityBase)
  }

  const odds: TournamentOdd[] = []
  for (const entry of fieldIndex.entries) {
    const quotes = quotesByPlayer.get(entry.id) || []
    if (quotes.length === 0) continue
    const medianAmerican = median(quotes.map(quote => quote.americanOdds))
    const medianDecimal = median(quotes.map(quote => quote.decimalOdds))
    const medianRawProbability = median(quotes.map(quote => quote.rawProbability))
    const consensusProbability = median(quotes.map(quote => quote.normalizedProbability))
    if (medianRawProbability === null || consensusProbability === null) continue
    odds.push({
      playerId: entry.id,
      playerName: entry.name,
      americanOdds: medianAmerican === null ? null : Math.round(medianAmerican),
      decimalOdds: medianDecimal === null ? null : Number(medianDecimal.toFixed(6)),
      impliedProbability: Number(medianRawProbability.toFixed(8)),
      consensusProbability: Number(consensusProbability.toFixed(8)),
      books: Array.from(new Set(quotes.map(quote => quote.bookKey))).sort(),
      source: THE_ODDS_API_SOURCE,
      capturedAt: capturedAtIso,
    })
  }

  odds.sort((a, b) =>
    b.consensusProbability - a.consensusProbability ||
    a.playerName.localeCompare(b.playerName)
  )

  return {
    status: 'ok',
    fallbackReason: null,
    source: THE_ODDS_API_SOURCE,
    sourceSportKey,
    marketKey: THE_ODDS_API_MARKET,
    eventId: event.id || null,
    eventName: event.home_team || event.away_team || event.sport_title || null,
    sportTitle: event.sport_title || null,
    tournamentName,
    tournamentStartDate: tournamentStartDate || null,
    capturedAt: capturedAtIso,
    fieldFingerprint,
    quality: {
      ok: true,
      reason: 'ok',
      ...qualityBase,
    },
    odds,
  }
}

export function isUsableTournamentOddsSnapshot(snapshot: unknown, field?: FieldLike[]): snapshot is TournamentOddsSnapshot {
  const parsed = parseTournamentOddsSnapshot(snapshot)
  if (!parsed) return false
  if (parsed.status !== 'ok' || !parsed.quality?.ok || !Array.isArray(parsed.odds) || parsed.odds.length === 0) return false
  if (field) {
    if (parsed.fieldFingerprint === oddsFieldFingerprint(field)) return true
    const currentField = buildFieldIndex(field)
    if (currentField.entries.length === 0) return false
    const currentIds = new Set(currentField.entries.map(entry => entry.id))
    const currentNames = new Set(currentField.entries.map(entry => entry.normalizedName))
    const matched = parsed.odds.filter(odd => (
      (odd.playerId && currentIds.has(String(odd.playerId))) ||
      currentNames.has(normalizeGolfName(odd.playerName))
    )).length
    if (matched / currentField.entries.length < DEFAULT_MIN_FIELD_COVERAGE) return false
  }
  return true
}

export function parseTournamentOddsSnapshot(value: unknown): TournamentOddsSnapshot | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<TournamentOddsSnapshot>
  if (candidate.source !== THE_ODDS_API_SOURCE) return null
  if (candidate.marketKey !== THE_ODDS_API_MARKET) return null
  if (candidate.status !== 'ok' && candidate.status !== 'fallback') return null
  if (typeof candidate.capturedAt !== 'string') return null
  if (!candidate.quality || typeof candidate.quality !== 'object') return null
  if (!Array.isArray(candidate.odds)) return null
  return candidate as TournamentOddsSnapshot
}

export async function fetchTheOddsApiTournamentOdds({
  tournamentName,
  tournamentStartDate,
  field,
  apiKey = process.env.THE_ODDS_API_KEY,
  fetchImpl = fetch,
  capturedAt,
  now,
  regions = 'us',
}: {
  tournamentName: string
  tournamentStartDate?: string | null
  field: FieldLike[]
  apiKey?: string
  fetchImpl?: typeof fetch
  capturedAt?: string
  now?: string | Date
  regions?: string
}): Promise<TournamentOddsSnapshot> {
  const capturedAtIso = safeIso(capturedAt, new Date().toISOString())
  const sourceSportKey = selectTheOddsApiSportKey(tournamentName)
  const fieldFingerprint = oddsFieldFingerprint(field)

  if (!sourceSportKey) {
    return fallbackSnapshot({
      reason: 'unsupported_tournament',
      sourceSportKey: null,
      tournamentName,
      tournamentStartDate: tournamentStartDate || null,
      capturedAt: capturedAtIso,
      fieldFingerprint,
    })
  }

  if (!apiKey) {
    return fallbackSnapshot({
      reason: 'missing_THE_ODDS_API_KEY',
      sourceSportKey,
      tournamentName,
      tournamentStartDate: tournamentStartDate || null,
      capturedAt: capturedAtIso,
      fieldFingerprint,
    })
  }

  const url = new URL(`${THE_ODDS_API_BASE_URL}/sports/${sourceSportKey}/odds/`)
  url.searchParams.set('apiKey', apiKey)
  url.searchParams.set('regions', regions)
  url.searchParams.set('markets', THE_ODDS_API_MARKET)
  url.searchParams.set('oddsFormat', 'american')
  url.searchParams.set('dateFormat', 'iso')

  try {
    const response = await fetchImpl(url)
    if (!response.ok) {
      return fallbackSnapshot({
        reason: `fetch_failed(${response.status})`,
        sourceSportKey,
        tournamentName,
        tournamentStartDate: tournamentStartDate || null,
        capturedAt: capturedAtIso,
        fieldFingerprint,
      })
    }
    const data = await response.json().catch(() => null)
    const events = Array.isArray(data) ? data : []
    return buildTournamentOddsSnapshot({
      tournamentName,
      tournamentStartDate,
      field,
      events,
      capturedAt: capturedAtIso,
      now: now || capturedAtIso,
    })
  } catch {
    return fallbackSnapshot({
      reason: 'fetch_failed',
      sourceSportKey,
      tournamentName,
      tournamentStartDate: tournamentStartDate || null,
      capturedAt: capturedAtIso,
      fieldFingerprint,
    })
  }
}
