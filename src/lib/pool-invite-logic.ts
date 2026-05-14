export type PreviousPlayerEntry = {
  user_id: string | null
  display_name?: string | null
}

export type InviteStatus = {
  status?: string | null
}

export function buildPreviousPlayerCandidates({
  previousEntries,
  currentPoolEntryUserIds,
  existingInviteUserIds,
  ownerUserId,
}: {
  previousEntries: PreviousPlayerEntry[]
  currentPoolEntryUserIds: string[]
  existingInviteUserIds: string[]
  ownerUserId: string
}) {
  const blocked = new Set([ownerUserId, ...currentPoolEntryUserIds, ...existingInviteUserIds].filter(Boolean))
  const seen = new Set<string>()
  const candidates: { userId: string; displayName: string }[] = []

  for (const entry of previousEntries) {
    if (!entry.user_id || blocked.has(entry.user_id) || seen.has(entry.user_id)) continue
    seen.add(entry.user_id)
    candidates.push({
      userId: entry.user_id,
      displayName: entry.display_name?.trim() || 'Player',
    })
  }

  return candidates.sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export function summarizeInviteStatuses(invites: InviteStatus[]) {
  return invites.reduce(
    (summary, invite) => {
      if (invite.status === 'accepted') summary.accepted += 1
      else if (invite.status === 'declined') summary.declined += 1
      else if (invite.status === 'pending') summary.pending += 1
      return summary
    },
    { pending: 0, accepted: 0, declined: 0 }
  )
}
