export type PreviousPlayerEntry = {
  pool_id?: string | null
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
  const seen = new Map<string, { userId: string; displayName: string; sourcePoolIds: string[] }>()

  for (const entry of previousEntries) {
    if (!entry.user_id || blocked.has(entry.user_id)) continue
    const existing = seen.get(entry.user_id)
    if (existing) {
      if (entry.pool_id && !existing.sourcePoolIds.includes(entry.pool_id)) existing.sourcePoolIds.push(entry.pool_id)
      continue
    }
    seen.set(entry.user_id, {
      userId: entry.user_id,
      displayName: entry.display_name?.trim() || 'Player',
      sourcePoolIds: entry.pool_id ? [entry.pool_id] : [],
    })
  }

  return Array.from(seen.values()).sort((a, b) => a.displayName.localeCompare(b.displayName))
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
