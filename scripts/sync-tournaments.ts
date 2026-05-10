/**
 * Tournament Sync Script
 * Pulls PGA Tour schedule from ESPN and syncs to Supabase.
 * 
 * Usage:
 *   npx tsx scripts/sync-tournaments.ts          # sync upcoming
 *   npx tsx scripts/sync-tournaments.ts --live    # also pull live leaderboards
 * 
 * Run weekly via cron for schedule sync.
 * Run every 5 min during tournament rounds for live scores.
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const ESPN_SCHEDULE_URL = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scorepanel'
const ESPN_LEADERBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/leaderboard'

interface ESPNEvent {
  id: string
  name: string
  date: string
  endDate: string
  competitions?: Array<{
    id: string
    status: { type: { state: string } }
    competitors?: Array<{
      id: string
      athlete: {
        id: string
        displayName: string
        firstName: string
        lastName: string
      }
      score: { value: number; displayValue: string }
      stats?: Array<{ name: string; value: string }>
      status?: { type: { name: string } }
    }>
  }>
  venue?: { fullName: string; address?: { city: string; state: string } }
}

async function fetchSchedule(): Promise<ESPNEvent[]> {
  const res = await fetch(ESPN_SCHEDULE_URL)
  if (!res.ok) throw new Error(`ESPN schedule error: ${res.status}`)
  const data = await res.json()
  // ESPN returns events nested in sections
  const events: ESPNEvent[] = []
  if (data.events) {
    events.push(...data.events)
  }
  if (data.sections) {
    for (const section of data.sections) {
      if (section.events) events.push(...section.events)
    }
  }
  return events
}

async function fetchLeaderboard(eventId: string) {
  const url = `${ESPN_LEADERBOARD_URL}?event=${eventId}`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  return data
}

async function main() {
  const args = process.argv.slice(2)
  const doLive = args.includes('--live')

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY)

  console.log('Fetching PGA Tour schedule from ESPN...')
  const events = await fetchSchedule()
  console.log(`Found ${events.length} events`)

  let synced = 0
  let updated = 0

  for (const event of events) {
    const endDate = new Date(event.endDate || event.date)
    const isPast = endDate < new Date()
    const startDate = event.date?.split('T')[0] || event.date
    const end = event.endDate?.split('T')[0] || event.endDate
    const course = event.venue?.fullName || null

    // Determine status
    let status = 'upcoming'
    if (isPast) status = 'completed'
    if (event.competitions?.[0]?.status?.type?.state === 'in') status = 'live'

    const { data: existing } = await supabase
      .from('gpp_tournaments')
      .select('id')
      .eq('external_id', event.id)
      .maybeSingle()

    const row: Record<string, any> = {
      name: event.name,
      start_date: startDate,
      end_date: end,
      course,
      status,
    }

    if (existing) {
      await supabase.from('gpp_tournaments').update(row).eq('id', existing.id)
      updated++
    } else {
      row.external_id = event.id
      await supabase.from('gpp_tournaments').insert(row)
      synced++
    }

    // Live leaderboard fetch
    if (doLive && status === 'live' && event.competitions?.[0]) {
      console.log(`  Fetching live leaderboard for ${event.name}...`)
      const lb = await fetchLeaderboard(event.id)
      if (lb) {
        // Extract leaderboard and field
        const competition = lb.events?.[0]?.competitions?.[0] || event.competitions[0]
        const players = (competition.competitors || []).map((c: any) => ({
          id: c.athlete?.id || c.id,
          name: c.athlete?.displayName || 'Unknown',
          firstName: c.athlete?.firstName || '',
          lastName: c.athlete?.lastName || '',
          scoreToPar: c.score?.value != null ? c.score.value : null,
          displayScore: c.score?.displayValue || 'E',
          strokes: null as number | null,
          position: c.status?.type?.name || '',
          madeCut: !c.status?.type?.name?.toLowerCase().includes('cut'),
          isWithdrawn: c.status?.type?.name?.toLowerCase().includes('wd'),
        }))

        await supabase
          .from('gpp_tournaments')
          .update({
            leaderboard_json: players,
            field_json: players,
          })
          .eq('external_id', event.id)

        console.log(`    ${players.length} players loaded`)
      }
    }
  }

  console.log(`\nDone. Synced: ${synced} new, Updated: ${updated} existing`)
}

main().catch(err => {
  console.error('Sync failed:', err)
  process.exit(1)
})
