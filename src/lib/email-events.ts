type ReserveEmailEventInput = {
  poolId?: string | null
  entryId?: string | null
  emailType: string
  dedupeKey: string
  recipient?: string | null
  payload?: Record<string, unknown>
}

const PENDING_RETRY_AFTER_MS = 10 * 60 * 1000

function isDuplicateError(error: any) {
  const message = String(error?.message || '').toLowerCase()
  return error?.code === '23505' || message.includes('duplicate') || message.includes('unique')
}

function pendingIsFresh(sentAt?: string | null) {
  const sentAtMs = sentAt ? new Date(sentAt).getTime() : NaN
  return Number.isFinite(sentAtMs) && Date.now() - sentAtMs < PENDING_RETRY_AFTER_MS
}

async function reserveExistingEmailEvent(supabase: any, input: ReserveEmailEventInput) {
  const { data: existing, error: existingError } = await supabase
    .from('gpp_email_events')
    .select('id, status, sent_at')
    .eq('dedupe_key', input.dedupeKey)
    .maybeSingle()

  if (existingError) throw existingError
  if (!existing) return { reserved: false, duplicate: true, id: null as string | null }
  if (existing.status === 'sent') return { reserved: false, duplicate: true, id: null as string | null }
  if (existing.status === 'pending' && pendingIsFresh(existing.sent_at)) {
    return { reserved: false, duplicate: true, id: null as string | null }
  }

  const { data, error } = await supabase
    .from('gpp_email_events')
    .update({
      pool_id: input.poolId || null,
      entry_id: input.entryId || null,
      email_type: input.emailType,
      recipient: input.recipient || null,
      status: 'pending',
      payload: input.payload || {},
      error: null,
      sent_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
    .neq('status', 'sent')
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!data?.id) return { reserved: false, duplicate: true, id: null as string | null }
  return { reserved: true, duplicate: false, id: data.id as string }
}

export async function reserveEmailEvent(supabase: any, input: ReserveEmailEventInput) {
  const { data, error } = await supabase
    .from('gpp_email_events')
    .insert({
      pool_id: input.poolId || null,
      entry_id: input.entryId || null,
      email_type: input.emailType,
      dedupe_key: input.dedupeKey,
      recipient: input.recipient || null,
      status: 'pending',
      payload: input.payload || {},
    })
    .select('id')
    .single()

  if (error) {
    if (isDuplicateError(error)) return reserveExistingEmailEvent(supabase, input)
    throw error
  }

  return { reserved: true, duplicate: false, id: data?.id as string }
}

export async function finishEmailEvent(supabase: any, id: string | null | undefined, status: 'sent' | 'skipped' | 'failed', error?: string) {
  if (!id) return
  await supabase
    .from('gpp_email_events')
    .update({ status, error: error ? error.slice(0, 500) : null, sent_at: new Date().toISOString() })
    .eq('id', id)
}
