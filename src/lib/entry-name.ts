export const DUPLICATE_ENTRY_NAME_MESSAGE = 'That entry name is already used in this pool. Use a different name.'

export function normalizeEntryName(name: string | null | undefined) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

export function isDuplicateEntryNameError(error: { message?: string; code?: string } | null | undefined) {
  const message = error?.message || ''
  return error?.code === '23505' || message.includes('gpp_entries_active_pool_name_unique') || message.includes(DUPLICATE_ENTRY_NAME_MESSAGE)
}
