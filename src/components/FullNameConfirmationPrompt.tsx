'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type MissingFullNameEntry = {
  id: string
  poolName: string
  displayName: string
}

type Props = {
  userId: string
  email: string
  displayName: string
  initialFullName: string
  entries: MissingFullNameEntry[]
}

export default function FullNameConfirmationPrompt({ userId, email, displayName, initialFullName, entries }: Props) {
  const router = useRouter()
  const [pendingEntries, setPendingEntries] = useState(entries)
  const [fullNameValue, setFullNameValue] = useState(initialFullName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient() as any

  useEffect(() => {
    setPendingEntries(entries)
  }, [entries])

  useEffect(() => {
    setFullNameValue(initialFullName)
  }, [initialFullName])

  const currentEntry = pendingEntries[0]
  if (!currentEntry) return null

  async function saveFullName() {
    const nextFullName = fullNameValue.trim().replace(/\s+/g, ' ')
    if (!nextFullName) {
      setError('Enter your full name.')
      return
    }

    setSaving(true)
    setError('')
    const confirmedAt = new Date().toISOString()
    const entryIds = pendingEntries.map(entry => entry.id)

    const { error: profileError } = await supabase
      .from('gpp_profiles')
      .upsert({ id: userId, email, display_name: displayName || nextFullName, full_name: nextFullName, full_name_confirmed_at: confirmedAt })

    if (profileError) {
      setError('Could not save full name. Try again.')
      setSaving(false)
      return
    }

    const { error: entryError } = await supabase
      .from('gpp_entries')
      .update({ full_name: nextFullName, full_name_confirmed_at: confirmedAt })
      .in('id', entryIds)
      .eq('user_id', userId)

    if (entryError) {
      setError('Could not save full name. Try again.')
      setSaving(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          full_name: nextFullName,
        },
      }).catch(() => undefined)
    }

    setPendingEntries([])
    setSaving(false)
    router.refresh()
  }

  const contextLine = pendingEntries.length > 1
    ? `${pendingEntries.length} active entries need this.`
    : `${currentEntry.poolName} · ${currentEntry.displayName}`

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-[#123c2f]/65 px-4 py-6">
      <div className="w-full max-w-sm border-2 border-[#123c2f] bg-white p-5 shadow-[8px_8px_0_#d8cab0]">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8a6724]">Pool runner</p>
        <h2 className="mt-1 text-2xl font-black text-[#123c2f]">Add your full name</h2>
        <p className="mt-1 text-sm font-semibold text-[#657168]">Only the pool runner sees this.</p>
        <p className="mt-3 border border-[#d8cab0] bg-[#fbf7ed] px-3 py-2 text-xs font-semibold text-[#657168]">{contextLine}</p>
        <div className="mt-4">
          <label className="mb-1 block text-sm font-bold text-stone-700">Full name</label>
          <input
            type="text"
            value={fullNameValue}
            onChange={event => setFullNameValue(event.target.value.slice(0, 80))}
            maxLength={80}
            autoComplete="name"
            autoFocus
            className="w-full rounded-none border border-stone-300 bg-white px-4 py-3 text-stone-900 focus:border-[#123c2f] focus:outline-none focus:ring-2 focus:ring-[#d8cab0]"
          />
        </div>
        {error ? <p className="mt-3 border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
        <button
          type="button"
          onClick={saveFullName}
          disabled={saving || !fullNameValue.trim()}
          className="mt-4 w-full border-2 border-[#123c2f] bg-[#123c2f] px-4 py-3 text-sm font-black uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#0f2f25] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save and continue'}
        </button>
      </div>
    </div>
  )
}
