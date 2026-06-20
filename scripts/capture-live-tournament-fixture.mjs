import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

function readArg(name, fallback = null) {
  const prefix = `${name}=`
  const directIndex = process.argv.indexOf(name)
  if (directIndex >= 0 && process.argv[directIndex + 1]) return process.argv[directIndex + 1]
  const inline = process.argv.find(arg => arg.startsWith(prefix))
  return inline ? inline.slice(prefix.length) : fallback
}

const externalId = readArg('--external-id', '401811952')
const outPath = resolve(readArg('--out', `test-fixtures/live-tournament/${externalId}-live.json`))
const scenarioNow = readArg('--scenario-now')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  console.error('Tip: run this after loading production env, or from a secure shell with those variables set.')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })
const { data, error } = await supabase
  .from('gpp_tournaments')
  .select('external_id, name, status, start_date, end_date, last_scores_fetch, leaderboard_json')
  .eq('external_id', externalId)
  .single()

if (error) {
  console.error(error.message)
  process.exit(1)
}

const PLAYER_FIXTURE_KEYS = ['id', 'name', 'firstName', 'lastName', 'country', 'position', 'score', 'scoreToPar', 'roundScore', 'thru', 'status', 'teeTime', 'startTee', 'strokes']
const ROUND_FIXTURE_KEYS = ['round', 'complete', 'roundScoreToPar', 'cumulativeScoreToPar']

function pickKeys(source, keys) {
  return Object.fromEntries(keys.filter(key => key in source).map(key => [key, source[key]]))
}

function reduceLeaderboardForReplay(leaderboard) {
  return leaderboard.map(player => {
    const nextPlayer = pickKeys(player, PLAYER_FIXTURE_KEYS)
    if (Array.isArray(player.roundScores)) {
      nextPlayer.roundScores = player.roundScores.map(round => pickKeys(round, ROUND_FIXTURE_KEYS))
    }
    return nextPlayer
  })
}

const rawLeaderboard = Array.isArray(data.leaderboard_json) ? data.leaderboard_json : []
const leaderboard = reduceLeaderboardForReplay(rawLeaderboard)
const safeName = String(data.name || externalId).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || externalId
const fixtureId = `${safeName}-live`
const effectiveNow = scenarioNow || data.last_scores_fetch || new Date().toISOString()
const fixture = {
  fixture: fixtureId,
  capturedAt: new Date().toISOString(),
  privacy: 'Public tournament leaderboard data only; no customer pool, entry, profile, email, or passcode rows.',
  source: { table: 'gpp_tournaments', external_id: data.external_id },
  scenarioNow: effectiveNow,
  tournament: {
    id: `fixture-${safeName}`,
    external_id: data.external_id,
    name: data.name,
    status: data.status,
    start_date: data.start_date,
    end_date: data.end_date,
    last_scores_fetch: data.last_scores_fetch || effectiveNow,
    leaderboard_json: leaderboard,
  },
  pools: [{
    id: 'fixture-pool-locked',
    tournament_id: `fixture-${safeName}`,
    is_locked: true,
    is_completed: false,
  }],
}

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, `${JSON.stringify(fixture, null, 2)}\n`)
console.log(JSON.stringify({ outPath, externalId, tournament: data.name, leaderboardRows: leaderboard.length }, null, 2))
