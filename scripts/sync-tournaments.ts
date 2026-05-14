/**
 * Tournament Sync Script
 * Pulls PGA Tour schedule from ESPN and syncs to Supabase.
 *
 * Usage:
 *   npx tsx scripts/sync-tournaments.ts          # sync upcoming schedule + any exposed fields
 *   npx tsx scripts/sync-tournaments.ts --live    # also refresh live leaderboards
 *
 * Run daily/weekly for schedule + field availability.
 * Run every 5 min during tournament rounds for live scores.
 */

import { syncTournaments } from '../src/lib/tournament-sync'

function parseArgs() {
  const args = process.argv.slice(2)
  return {
    doLive: args.includes('--live'),
    season: Number(args.find(arg => arg.startsWith('--season='))?.split('=')[1]) || new Date().getFullYear(),
  }
}

async function main() {
  const result = await syncTournaments(parseArgs())
  console.log(`Fetched ${result.fetched} PGA events for ${result.season}`)
  console.log(`Done. Inserted: ${result.inserted}, Updated: ${result.updated}, Fields refreshed: ${result.fieldsUpdated}, Leaderboards refreshed: ${result.leaderboardsUpdated}, Pools auto-locked: ${result.poolsAutoLocked}`)
}

main().catch(err => {
  console.error('Sync failed:', err)
  process.exit(1)
})
