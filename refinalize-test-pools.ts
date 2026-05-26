import { createClient } from '@supabase/supabase-js'
import { findPgaTourTournament, getPgaTourField, getPgaTourSchedule } from './src/lib/pga-tour-field'
import { autoFinalizeGroupedPools } from './src/lib/grouped-pool-auto-lock'

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // 1. Find Schwab tournament
  const { data: t } = await supabase.from('gpp_tournaments').select('id, name, start_date, field_json').eq('name','Charles Schwab Challenge').single()
  if (!t) throw new Error('Tournament not found')
  console.log('Old field:', t.field_json?.length, 'players')

  // 2. Fetch PGA Tour field with OWGR
  const pgaSchedule = await getPgaTourSchedule(2026)
  const match = findPgaTourTournament({ pgaSchedule, eventName: t.name, startDate: t.start_date })
  if (!match?.tournamentId) throw new Error('No PGA Tour match')
  const pgaField = await getPgaTourField(match.tournamentId)
  console.log('PGA Tour field:', pgaField.length, 'players')
  const withOwgr = pgaField.filter(p => p.owgr != null).length
  console.log('With OWGR:', withOwgr)

  // 3. Update tournament
  await supabase.from('gpp_tournaments').update({ field_json: pgaField }).eq('id', t.id)
  console.log('Tournament field_json updated')

  // 4. Clear and re-finalize test pools
  await supabase.from('gpp_pools').update({ groups_finalized_at: null, pick_groups_json: null, field_snapshot_json: null }).eq('tournament_id', t.id).in('game_format', ['ranked_groups','random_groups'])
  console.log('Pools reset')

  const result = await autoFinalizeGroupedPools(supabase, { now: new Date('2026-05-26T09:00:00-04:00') })
  console.log('Auto-finalize:', JSON.stringify(result, null, 2))

  // 5. Show groups
  const { data: pools } = await supabase.from('gpp_pools').select('passcode, game_format, pick_groups_json').eq('tournament_id', t.id)
    .in('game_format', ['ranked_groups','random_groups']).not('pick_groups_json', 'is', null)
  for (const p of pools || []) {
    console.log('\n' + p.passcode, p.game_format)
    for (const g of p.pick_groups_json || []) {
      console.log(g.label + ':', g.players.map((pl: any) => pl.name + (pl.rank ? ' #' + pl.rank : '')).join(', '))
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
