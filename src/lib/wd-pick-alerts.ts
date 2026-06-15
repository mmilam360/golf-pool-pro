import type { GolfPlayer } from '@/lib/golf-api'
import { reserveEmailEvent, finishEmailEvent } from '@/lib/email-events'
import { entryRecipientEmail, siteOrigin } from '@/lib/pool-email-recipients'
import { sendWdPickAlertEmail } from '@/lib/pool-transactional-emails'

type WdAlertResult = {
  poolsChecked: number
  affectedEntries: number
  sent: number
  skipped: number
  noEmail: number
  duplicate: number
}

function withdrawnNames(players: GolfPlayer[]) {
  return new Set(players
    .filter(player => String(player?.status || '').toLowerCase() === 'wd')
    .map(player => player.name)
    .filter(Boolean))
}

function dedupePart(names: string[]) {
  return names.map(name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-')).sort().join('|')
}

export async function sendWdPickAlertsForTournament(supabase: any, tournamentId: string, players: GolfPlayer[]): Promise<WdAlertResult> {
  const result: WdAlertResult = { poolsChecked: 0, affectedEntries: 0, sent: 0, skipped: 0, noEmail: 0, duplicate: 0 }
  const wdNames = withdrawnNames(players)
  if (wdNames.size === 0) return result

  const { data: pools, error: poolsError } = await supabase
    .from('gpp_pools')
    .select('id, name, is_locked, is_completed, gpp_tournaments(name, status, start_date)')
    .eq('tournament_id', tournamentId)
    .eq('is_locked', false)
    .eq('is_completed', false)

  if (poolsError) throw poolsError
  const openPools = (pools || []).filter((pool: any) => {
    const tournament = Array.isArray(pool.gpp_tournaments) ? pool.gpp_tournaments[0] : pool.gpp_tournaments
    return tournament?.status !== 'live' && tournament?.status !== 'completed'
  })
  const poolIds = openPools.map((pool: any) => pool.id)
  result.poolsChecked = openPools.length
  if (poolIds.length === 0) return result

  const poolById = new Map(openPools.map((pool: any) => [pool.id, pool]))
  const { data: entries, error: entriesError } = await supabase
    .from('gpp_entries')
    .select('id, pool_id, user_id, display_name, notification_email, golfer_picks, is_removed')
    .in('pool_id', poolIds)
    .eq('is_removed', false)

  if (entriesError) throw entriesError

  const origin = siteOrigin()
  for (const entry of entries || []) {
    const picks = Array.isArray(entry.golfer_picks) ? entry.golfer_picks : []
    const affectedPicks = picks.filter((name: string) => wdNames.has(name))
    if (affectedPicks.length === 0) continue
    result.affectedEntries++

    const recipient = await entryRecipientEmail(supabase, entry)
    if (!recipient) {
      result.noEmail++
      continue
    }

    const pool = poolById.get(entry.pool_id)
    const tournament = Array.isArray(pool?.gpp_tournaments) ? pool.gpp_tournaments[0] : pool?.gpp_tournaments
    const dedupeKey = `wd_pick:${entry.pool_id}:${entry.id}:${dedupePart(affectedPicks)}`
    const event = await reserveEmailEvent(supabase, {
      poolId: entry.pool_id,
      entryId: entry.id,
      emailType: 'wd_pick_alert',
      dedupeKey,
      recipient,
      payload: { poolName: pool?.name || null, entryName: entry.display_name, withdrawnPicks: affectedPicks },
    })
    if (!event.reserved) {
      result.duplicate++
      continue
    }

    try {
      const sendResult = await sendWdPickAlertEmail({
        supabase,
        origin,
        recipient,
        pool,
        tournament,
        entry,
        withdrawnPicks: affectedPicks,
      })
      if ((sendResult as any)?.sent === false || (sendResult as any)?.skipped) {
        result.skipped++
        await finishEmailEvent(supabase, event.id, 'skipped', JSON.stringify(sendResult).slice(0, 300))
      } else {
        result.sent++
        await finishEmailEvent(supabase, event.id, 'sent')
      }
    } catch (error: any) {
      result.skipped++
      await finishEmailEvent(supabase, event.id, 'failed', error?.message || 'Email failed')
    }
  }

  return result
}
