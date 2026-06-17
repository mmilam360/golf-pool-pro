export const DUPLICATE_ENTRY_NAME_MESSAGE = 'That entry name is already used in this pool. Use a different name.'

export function normalizeEntryName(name: string | null | undefined) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

export function isDuplicateEntryNameError(error: { message?: string; code?: string } | null | undefined) {
  const message = error?.message || ''
  return error?.code === '23505' || message.includes('gpp_entries_active_pool_name_unique') || message.includes(DUPLICATE_ENTRY_NAME_MESSAGE)
}


export async function entryNameTaken(supabase: any, poolId: string, displayName: string, excludeEntryId?: string | null) {
  const normalizedName = normalizeEntryName(displayName)
  if (!poolId || !normalizedName) return false

  const { data, error } = await supabase
    .from('gpp_entries')
    .select('id, display_name')
    .eq('pool_id', poolId)
    .eq('is_removed', false)

  if (error) throw error
  return (data || []).some((entry: { id?: string | null; display_name?: string | null }) => {
    if (excludeEntryId && entry.id === excludeEntryId) return false
    return normalizeEntryName(entry.display_name) === normalizedName
  })
}

