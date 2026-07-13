import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  americanOddsToImpliedProbability,
  buildTournamentOddsSnapshot,
  isUsableTournamentOddsSnapshot,
  normalizeGolfName,
  selectTheOddsApiSportKey,
} from '../src/lib/tournament-odds.ts'
import { buildPickGroups, playerRanking, progressiveRankedTierSizes } from '../src/lib/pool-formats.ts'
import { ensureTournamentOddsSnapshot } from '../src/lib/grouped-pool-group-builder.ts'

const player = (id, name, owgr = null, status = 'active') => ({
  id,
  name,
  firstName: name.split(' ')[0] || '',
  lastName: name.split(' ').slice(1).join(' '),
  status,
  owgr,
})

const capturedAt = '2026-07-13T14:00:00.000Z'
const lastUpdate = '2026-07-13T13:30:00.000Z'

function majorEvent({ sportKey = 'golf_the_open_championship_winner', title = 'The Open Winner', bookmakers = [] } = {}) {
  return {
    id: 'open-2026-outright',
    sport_key: sportKey,
    sport_title: title,
    commence_time: '2026-07-16T11:00:00.000Z',
    bookmakers,
  }
}

function book(key, outcomes, marketKey = 'outrights', update = lastUpdate) {
  return {
    key,
    title: key,
    last_update: update,
    markets: [{ key: marketKey, last_update: update, outcomes }],
  }
}

function outcome(name, price) {
  return { name, price }
}

assert.equal(
  Number(americanOddsToImpliedProbability(650).toFixed(6)),
  0.133333,
  '+650 converts to the correct implied win probability'
)
assert.equal(
  Number(americanOddsToImpliedProbability(-120).toFixed(6)),
  0.545455,
  '-120 converts to the correct implied win probability'
)
assert.equal(
  selectTheOddsApiSportKey('The Open Championship'),
  'golf_the_open_championship_winner',
  'The Odds API sport key is supported for The Open'
)
assert.equal(
  selectTheOddsApiSportKey('Travelers Championship'),
  null,
  'non-major PGA Tour events are intentionally unsupported by The Odds API provider'
)
assert.equal(
  selectTheOddsApiSportKey('Senior Open Championship'),
  null,
  'other open championships must not consume The Open odds endpoint'
)
assert.equal(
  normalizeGolfName('Ludvig Åberg Jr.'),
  normalizeGolfName('Ludvig Aberg'),
  'name normalization removes accents and suffix noise without fuzzy matching'
)
assert.equal(
  playerRanking(player('unranked', 'Aaron Rai')),
  null,
  'missing OWGR must not inherit source-array fallback rank'
)

const field = [
  player('aaron', 'Aaron Rai', null),
  player('scottie', 'Scottie Scheffler', 1),
  player('rory', 'Rory McIlroy', 2),
  player('ludvig', 'Ludvig Aberg', 4),
  player('hideki', 'Hideki Matsuyama', 10),
  player('robert', 'Robert MacIntyre', 25),
]

const oddsSnapshot = buildTournamentOddsSnapshot({
  tournamentName: 'The Open Championship',
  tournamentStartDate: '2026-07-16',
  field,
  events: [majorEvent({
    bookmakers: [
      book('draftkings', [
        outcome('Scottie Scheffler', 700),
        outcome('Rory McIlroy', 600),
        outcome('Ludvig Aberg', 1200),
        outcome('Hideki Matsuyama', 1800),
        outcome('Bob MacIntyre', 4500),
        outcome('Tommy Fleetwood', 2800),
      ]),
      book('fanduel', [
        outcome('Scottie Scheffler', 650),
        outcome('Rory McIlroy', 650),
        outcome('Ludvig Åberg', 1100),
        outcome('Hideki Matsuyama', 2000),
        outcome('Robert MacIntyre', 4000),
        outcome('Tommy Fleetwood', 3000),
      ]),
    ],
  })],
  capturedAt,
  now: capturedAt,
})

assert.equal(oddsSnapshot.status, 'ok', oddsSnapshot.fallbackReason || 'odds snapshot should pass quality')
assert.equal(oddsSnapshot.quality.ok, true, 'odds quality gate should pass with broad coverage and top-OWGR coverage')
assert.equal(
  oddsSnapshot.odds.find(odd => odd.playerName === 'Robert MacIntyre')?.playerId,
  'robert',
  'reviewed alias Bob MacIntyre maps strictly to Robert MacIntyre'
)
assert.equal(
  oddsSnapshot.odds.find(odd => odd.playerName === 'Rory McIlroy')?.americanOdds,
  625,
  'snapshot stores a deterministic median American line for display'
)

const rankedGroups = buildPickGroups({
  field,
  format: 'ranked_groups',
  groupCount: 2,
  seed: 'ranked-seed',
  oddsSnapshot,
})
const rankedOrder = rankedGroups.flatMap(group => group.players.map(p => p.name))
assert.deepEqual(
  rankedOrder,
  ['Rory McIlroy', 'Scottie Scheffler', 'Ludvig Aberg', 'Hideki Matsuyama', 'Robert MacIntyre', 'Aaron Rai'],
  'ranked groups sort quoted golfers favorite-first, then unquoted OWGR, then unranked name tie-breakers'
)
const rorySnapshot = rankedGroups.flatMap(group => group.players).find(player => player.name === 'Rory McIlroy')
assert.deepEqual(
  progressiveRankedTierSizes(156, 2, 6),
  [30, 126],
  'two-tier ranked pools keep the elite tier small and leave the field tail in the second tier'
)
assert.deepEqual(
  progressiveRankedTierSizes(156, 6, 2),
  [10, 10, 20, 30, 40, 46],
  'six-tier ranked pools front-load contenders and leave the field tail in the final tier'
)
assert.deepEqual(
  progressiveRankedTierSizes(156, 12, 1),
  [5, 5, 5, 10, 10, 10, 10, 10, 15, 15, 15, 46],
  'twelve-tier ranked pools use one-pick-sized elite tiers and leave the final field tail wide'
)
const majorField = Array.from({ length: 156 }, (_, index) => player(`major-${index + 1}`, `Golfer ${String(index + 1).padStart(3, '0')}`, index + 1))
const progressiveGroups = buildPickGroups({
  field: majorField,
  format: 'ranked_groups',
  groupCount: 6,
  seed: 'major-ranked',
  picksPerGroup: 2,
})
assert.deepEqual(
  progressiveGroups.map(group => group.players.length),
  [10, 10, 20, 30, 40, 46],
  'new ranked groups use progressive tier sizes instead of equal 26-player tiers'
)
const evenRandomGroups = buildPickGroups({
  field: majorField,
  format: 'random_groups',
  groupCount: 6,
  seed: 'major-random',
  picksPerGroup: 2,
})
assert.deepEqual(
  evenRandomGroups.map(group => group.players.length),
  [26, 26, 26, 26, 26, 26],
  'Clubhouse Chaos keeps equal-sized random groups'
)
assert.equal(rorySnapshot?.rank, 2, 'rank remains OWGR for backward compatibility')
assert.equal(rorySnapshot?.owgrRank, 2, 'OWGR is exposed explicitly for odds-backed display')
assert.equal(rorySnapshot?.americanOdds, 625, 'American odds are copied into immutable pick_groups_json snapshots')
assert.equal(
  rorySnapshot?.impliedProbability,
  oddsSnapshot.odds.find(odd => odd.playerName === 'Rory McIlroy')?.impliedProbability,
  'frozen raw implied probability is not replaced with the de-vigged consensus value'
)
assert.equal(rorySnapshot?.oddsSource, 'the_odds_api', 'odds source is copied into immutable pick_groups_json snapshots')
assert.equal(rorySnapshot?.oddsCapturedAt, capturedAt, 'odds capture time is copied into immutable pick_groups_json snapshots')
assert.equal(rorySnapshot?.rankSource, 'odds', 'odds-backed players mark their frozen ranking source')

const fieldAfterMinorReplacement = [...field.slice(1), player('replacement', 'Open Qualifier', 90)]
assert.equal(
  isUsableTournamentOddsSnapshot(oddsSnapshot, fieldAfterMinorReplacement),
  true,
  'a minor field replacement keeps the frozen snapshot and uses OWGR for the new golfer'
)
const unrelatedField = Array.from({ length: 6 }, (_, index) => player(`other-${index}`, `Other Golfer ${index}`, index + 1))
assert.equal(
  isUsableTournamentOddsSnapshot(oddsSnapshot, unrelatedField),
  false,
  'a materially different field rejects an unrelated odds snapshot'
)
assert.equal(
  buildPickGroups({ field: unrelatedField, format: 'ranked_groups', groupCount: 2, seed: 'other', oddsSnapshot })
    .flatMap(group => group.players)
    .some(groupPlayer => groupPlayer.americanOdds != null),
  false,
  'rejected stale odds do not leak into newly frozen groups'
)

const owgrFallbackGroups = buildPickGroups({
  field,
  format: 'ranked_groups',
  groupCount: 2,
  seed: 'ranked-seed',
  oddsSnapshot: buildTournamentOddsSnapshot({
    tournamentName: 'The Open Championship',
    tournamentStartDate: '2026-07-16',
    field,
    events: [majorEvent({ bookmakers: [book('thinbook', [outcome('Scottie Scheffler', 700)])] })],
    capturedAt,
    now: capturedAt,
  }),
})
assert.deepEqual(
  owgrFallbackGroups.flatMap(group => group.players.map(p => p.name)),
  ['Scottie Scheffler', 'Rory McIlroy', 'Ludvig Aberg', 'Hideki Matsuyama', 'Robert MacIntyre', 'Aaron Rai'],
  'bad odds markets fall back to OWGR for the entire ranked tournament'
)
assert.equal(
  owgrFallbackGroups.flatMap(group => group.players).some(p => p.americanOdds != null),
  false,
  'fallback groups do not leak partial odds into pick_groups_json'
)

const staleSnapshot = buildTournamentOddsSnapshot({
  tournamentName: 'The Open Championship',
  tournamentStartDate: '2026-07-16',
  field,
  events: [majorEvent({
    bookmakers: [book('stale', [
      outcome('Scottie Scheffler', 700),
      outcome('Rory McIlroy', 600),
      outcome('Ludvig Aberg', 1200),
      outcome('Robert MacIntyre', 4500),
    ], 'outrights', '2026-07-08T13:30:00.000Z')],
  })],
  capturedAt,
  now: capturedAt,
})
assert.match(staleSnapshot.fallbackReason || '', /stale|no_usable_bookmakers/, 'stale markets fail the odds quality gate')

const wrongEvent = buildTournamentOddsSnapshot({
  tournamentName: 'The Open Championship',
  tournamentStartDate: '2026-07-16',
  field,
  events: [majorEvent({ sportKey: 'golf_us_open_winner', title: 'US Open Winner', bookmakers: [] })],
  capturedAt,
  now: capturedAt,
})
assert.match(wrongEvent.fallbackReason || '', /event_mismatch|unsupported/, 'wrong golf outright events fail closed')

const duplicateSnapshot = buildTournamentOddsSnapshot({
  tournamentName: 'The Open Championship',
  tournamentStartDate: '2026-07-16',
  field,
  events: [majorEvent({
    bookmakers: [book('duplicate', [
      outcome('Scottie Scheffler', 700),
      outcome('Scottie Scheffler', 650),
      outcome('Rory McIlroy', 600),
      outcome('Ludvig Aberg', 1200),
      outcome('Hideki Matsuyama', 1800),
      outcome('Robert MacIntyre', 4500),
    ])],
  })],
  capturedAt,
  now: capturedAt,
})
assert.equal(duplicateSnapshot.status, 'ok', 'duplicate provider rows for the same golfer are deduped, not market-fatal')
assert.equal(
  duplicateSnapshot.odds.find(odd => odd.playerName === 'Scottie Scheffler')?.americanOdds,
  650,
  'duplicate provider rows keep the strongest available line for that golfer within a book'
)

const randomWithOdds = buildPickGroups({ field, format: 'random_groups', groupCount: 3, seed: 'chaos', oddsSnapshot })
const randomWithoutOdds = buildPickGroups({ field, format: 'random_groups', groupCount: 3, seed: 'chaos' })
assert.deepEqual(randomWithOdds, randomWithoutOdds, 'random_groups remains seeded-random and ignores odds snapshots')

let providerCalls = 0
const savedSnapshots = []
const mockSupabase = {
  from(table) {
    assert.equal(table, 'gpp_tournaments')
    return {
      update(payload) {
        savedSnapshots.push(payload)
        return {
          eq() { return this },
          is() { return this },
          select() { return this },
          async maybeSingle() { return { data: { odds_snapshot_json: payload.odds_snapshot_json }, error: null } },
        }
      },
    }
  },
}
const fetchImpl = async url => {
  providerCalls++
  assert.match(String(url), /markets=outrights/, 'provider request uses the valid golf outright market')
  assert.match(String(url), /regions=us/, 'provider request spends one region credit')
  return {
    ok: true,
    status: 200,
    json: async () => [majorEvent({ bookmakers: [book('draftkings', [
      outcome('Scottie Scheffler', 700),
      outcome('Rory McIlroy', 600),
      outcome('Ludvig Aberg', 1200),
      outcome('Hideki Matsuyama', 1800),
      outcome('Robert MacIntyre', 4500),
    ], 'outrights', new Date().toISOString())] })],
  }
}
const tournament = {
  id: 'open-tournament',
  name: 'The Open Championship',
  start_date: '2026-07-16',
  odds_snapshot_json: null,
}
await ensureTournamentOddsSnapshot({
  supabase: mockSupabase,
  tournament,
  field,
  apiKey: 'test-key',
  fetchImpl,
  hydrateField: async players => players,
  capturedAt,
  now: capturedAt,
})
assert.equal(providerCalls, 1, 'first official-field pass calls the odds provider once')
assert.equal(savedSnapshots.length, 1, 'first provider result is frozen on the tournament')
await ensureTournamentOddsSnapshot({
  supabase: mockSupabase,
  tournament: { ...tournament, odds_snapshot_json: savedSnapshots[0].odds_snapshot_json },
  field,
  apiKey: 'test-key',
  fetchImpl,
  hydrateField: async players => players,
  capturedAt,
  now: capturedAt,
})
assert.equal(providerCalls, 1, 'a frozen tournament snapshot prevents repeat provider calls')
assert.equal(savedSnapshots.length, 1, 'cached odds do not rewrite the tournament snapshot')

const raceWinner = { ...oddsSnapshot, eventId: 'first-snapshot-wins' }
const raceSupabase = {
  from() {
    return {
      update() {
        return {
          eq() { return this },
          is() { return this },
          select() { return this },
          async maybeSingle() { return { data: null, error: null } },
        }
      },
      select() {
        return {
          eq() { return this },
          async maybeSingle() { return { data: { odds_snapshot_json: raceWinner }, error: null } },
        }
      },
    }
  },
}
const raceResult = await ensureTournamentOddsSnapshot({
  supabase: raceSupabase,
  tournament,
  field,
  apiKey: 'test-key',
  fetchImpl,
  hydrateField: async players => players,
  capturedAt,
  now: capturedAt,
})
assert.equal(raceResult?.eventId, 'first-snapshot-wins', 'concurrent locks all use the first snapshot frozen in the database')

for (const routePath of [
  'src/app/api/pools/finalize-groups/route.ts',
  'src/app/api/pools/finalize-groups-override/route.ts',
  'src/lib/grouped-pool-auto-lock.ts',
]) {
  const source = readFileSync(new URL(`../${routePath}`, import.meta.url), 'utf8')
  assert.match(source, /buildGroupedPickGroupsForLock/, `${routePath} must use the shared odds-aware lock pipeline`)
  assert.match(source, /\.is\('groups_finalized_at', null\)/, `${routePath} must only update unfinalized group snapshots`)
  assert.match(source, /\.select\('id'\)\s*\.maybeSingle\(\)/, `${routePath} must verify that its conditional finalization update won the race`)
}

const tournamentSyncSource = readFileSync(new URL('../src/lib/tournament-sync.ts', import.meta.url), 'utf8')
assert.equal(
  (tournamentSyncSource.match(/await ensureTournamentOddsSnapshot\(/g) || []).length,
  3,
  'PGA refresh, field refresh, and live sync all freeze an accepted major odds snapshot'
)
assert.match(
  tournamentSyncSource,
  /odds_snapshot_json: existing\.odds_snapshot_json/,
  'field refresh uses the existing tournament snapshot to avoid repeat provider calls'
)

console.log('odds-backed ranked group checks passed')
