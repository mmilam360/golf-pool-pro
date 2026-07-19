type EntrySavedEmailInput = {
  entryId: string
  poolId: string
  token?: string | null
  userId?: string | null
  origin: string
}

export async function sendEntrySavedEmail(input: EntrySavedEmailInput) {
  void input
  return { skipped: true, reason: 'entry_saved_disabled' as const }
}
