type ReserveEmailEventInput = {
  poolId?: string | null
  entryId?: string | null
  emailType: string
  dedupeKey: string
  recipient?: string | null
  payload?: Record<string, unknown>
}

function isDuplicateError(error: any) {
  const message = String(error?.message || '').toLowerCase()
  return error?.code === '23505' || message.includes('duplicate') || message.includes('unique')
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
    if (isDuplicateError(error)) return { reserved: false, duplicate: true, id: null as string | null }
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
