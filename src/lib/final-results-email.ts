import { reserveEmailEvent, finishEmailEvent } from '@/lib/email-events'
import { entryRecipientEmail, siteOrigin } from '@/lib/pool-email-recipients'
import { sendFinalResultsEmail } from '@/lib/pool-transactional-emails'

type FinalResultsEmailResult = {
  candidates: number
  sent: number
  skipped: number
  noEmail: number
  duplicate: number
}

export async function sendFinalResultsEmailsForPool(supabase: any, params: { pool: any; tournament: any }): Promise<FinalResultsEmailResult> {
  const result: FinalResultsEmailResult = { candidates: 0, sent: 0, skipped: 0, noEmail: 0, duplicate: 0 }
  const { pool, tournament } = params
  if (!pool?.id) return result

  const { data: entries, error } = await supabase
    .from('gpp_entries')
    .select('id, user_id, display_name, notification_email, rank, total_score, is_removed')
    .eq('pool_id', pool.id)
    .eq('is_removed', false)
    .order('rank', { ascending: true })

  if (error) throw error
  const activeEntries = entries || []
  const topEntries = activeEntries
    .filter((entry: any) => Number.isFinite(Number(entry.rank)))
    .slice(0, 3)
  const origin = siteOrigin()

  for (const entry of activeEntries) {
    result.candidates++
    const recipient = await entryRecipientEmail(supabase, entry)
    if (!recipient) {
      result.noEmail++
      continue
    }

    const event = await reserveEmailEvent(supabase, {
      poolId: pool.id,
      entryId: entry.id,
      emailType: 'final_results',
      dedupeKey: `final_results:${pool.id}:${entry.id}`,
      recipient,
      payload: { poolName: pool.name, entryName: entry.display_name, rank: entry.rank, totalScore: entry.total_score },
    })
    if (!event.reserved) {
      result.duplicate++
      continue
    }

    try {
      const sendResult = await sendFinalResultsEmail({
        origin,
        recipient,
        pool,
        tournament,
        entry,
        topEntries,
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
