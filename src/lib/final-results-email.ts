import { reserveEmailEvent, finishEmailEvent } from '@/lib/email-events'
import { entryRecipientEmail, siteOrigin } from '@/lib/pool-email-recipients'
import { sendFinalResultsDigestEmail } from '@/lib/pool-transactional-emails'
import { isScoredFinalResultsEntry } from './final-result-announcements'

type FinalResultsEmailResult = {
  candidates: number
  sent: number
  skipped: number
  noEmail: number
  duplicate: number
}

type PoolLike = {
  id: string
  name?: string | null
}

type EntryLike = {
  id: string
  pool_id: string
  user_id?: string | null
  display_name?: string | null
  notification_email?: string | null
  rank?: number | null
  total_score?: number | null
  counting_scores?: unknown
  is_removed?: boolean | null
}

function normalizedRecipient(email: string) {
  return email.trim().toLowerCase()
}

export async function sendFinalResultsEmailsForPools(supabase: any, params: { pools: PoolLike[]; tournament: any }): Promise<FinalResultsEmailResult> {
  const result: FinalResultsEmailResult = { candidates: 0, sent: 0, skipped: 0, noEmail: 0, duplicate: 0 }
  const pools = params.pools.filter(pool => pool?.id)
  if (!pools.length) return result

  const poolById = new Map(pools.map(pool => [pool.id, pool]))
  const { data: entries, error } = await supabase
    .from('gpp_entries')
    .select('id, pool_id, user_id, display_name, notification_email, rank, total_score, counting_scores, is_removed')
    .in('pool_id', pools.map(pool => pool.id))
    .eq('is_removed', false)
    .order('rank', { ascending: true })

  if (error) throw error

  const scoredEntries = ((entries || []) as EntryLike[]).filter(isScoredFinalResultsEntry)
  const topEntriesByPool = new Map<string, EntryLike[]>()
  for (const pool of pools) {
    topEntriesByPool.set(pool.id, scoredEntries.filter(entry => entry.pool_id === pool.id).slice(0, 3))
  }

  const origin = siteOrigin()
  const groups = new Map<string, {
    recipient: string
    events: { id: string; pool: PoolLike; entry: EntryLike; topEntries: EntryLike[] }[]
  }>()

  for (const entry of scoredEntries) {
    const pool = poolById.get(entry.pool_id)
    if (!pool) continue
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
      payload: {
        poolName: pool.name,
        entryName: entry.display_name,
        rank: entry.rank,
        totalScore: entry.total_score,
        delivery: 'digest',
      },
    })
    if (!event.reserved) {
      result.duplicate++
      continue
    }

    const key = normalizedRecipient(recipient)
    const group = groups.get(key) || { recipient: key, events: [] }
    group.events.push({
      id: event.id as string,
      pool,
      entry,
      topEntries: topEntriesByPool.get(pool.id) || [],
    })
    groups.set(key, group)
  }

  for (const group of Array.from(groups.values())) {
    try {
      const sendResult = await sendFinalResultsDigestEmail({
        origin,
        recipient: group.recipient,
        tournament: params.tournament,
        results: group.events.map(item => ({ pool: item.pool, entry: item.entry, topEntries: item.topEntries })),
      })

      if ((sendResult as any)?.sent === false || (sendResult as any)?.skipped) {
        result.skipped += group.events.length
        await Promise.all(group.events.map(item => finishEmailEvent(supabase, item.id, 'skipped', JSON.stringify(sendResult).slice(0, 300))))
      } else {
        result.sent++
        await Promise.all(group.events.map(item => finishEmailEvent(supabase, item.id, 'sent')))
      }
    } catch (error: any) {
      result.skipped += group.events.length
      await Promise.all(group.events.map(item => finishEmailEvent(supabase, item.id, 'failed', error?.message || 'Email failed')))
    }
  }

  return result
}

export async function sendFinalResultsEmailsForPool(supabase: any, params: { pool: PoolLike; tournament: any }): Promise<FinalResultsEmailResult> {
  return sendFinalResultsEmailsForPools(supabase, { pools: [params.pool], tournament: params.tournament })
}
