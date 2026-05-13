'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Tone = 'success' | 'error' | 'info'

function Toast({ message, tone }: { message: string; tone: Tone }) {
  const toneClass = tone === 'success'
    ? 'border-emerald-800 bg-[#f4efe3] text-[#123c2f]'
    : tone === 'error'
      ? 'border-red-700 bg-red-50 text-red-800'
      : 'border-[#8a6724] bg-[#fbf7ed] text-[#5f4617]'

  return (
    <div className={`fixed right-4 top-4 z-50 max-w-sm border-2 px-4 py-3 text-sm font-semibold shadow-[4px_4px_0_#d8cab0] ${toneClass}`}>
      {message}
    </div>
  )
}

export default function AccountPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [originalName, setOriginalName] = useState('')
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [originalMarketingOptIn, setOriginalMarketingOptIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; tone: Tone } | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadAccount() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted) return

      if (!user) {
        router.push('/login?redirect=/account')
        return
      }

      const { data: profile } = await supabase
        .from('gpp_profiles')
        .select('display_name, email')
        .eq('id', user.id)
        .maybeSingle()

      const fallbackName = user.user_metadata?.display_name
        || user.user_metadata?.full_name
        || user.email?.split('@')[0]
        || ''
      const nextName = profile?.display_name || fallbackName
      const nextMarketing = Boolean(user.user_metadata?.marketing_emails)

      setEmail(profile?.email || user.email || '')
      setName(nextName)
      setOriginalName(nextName)
      setMarketingOptIn(nextMarketing)
      setOriginalMarketingOptIn(nextMarketing)
      setLoading(false)
    }

    loadAccount()

    return () => { mounted = false }
  }, [router, supabase])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(timeout)
  }, [toast])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()

    if (!trimmedName) {
      setToast({ message: 'Enter a name first.', tone: 'error' })
      return
    }

    setSaving(true)

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      setToast({ message: 'Sign in again to update account settings.', tone: 'error' })
      setSaving(false)
      return
    }

    const { error: profileError } = await supabase
      .from('gpp_profiles')
      .upsert({ id: user.id, email: user.email || email, display_name: trimmedName })

    if (profileError) {
      setToast({ message: 'Name could not be saved. Try again.', tone: 'error' })
      setSaving(false)
      return
    }

    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        display_name: trimmedName,
        full_name: trimmedName,
        marketing_emails: marketingOptIn,
      },
    })

    if (metadataError) {
      setToast({ message: 'Name saved, but account metadata did not update.', tone: 'info' })
    } else {
      setToast({ message: 'Account settings saved.', tone: 'success' })
    }

    setOriginalName(trimmedName)
    setOriginalMarketingOptIn(marketingOptIn)
    setSaving(false)
  }

  const dirty = name.trim() !== originalName || marketingOptIn !== originalMarketingOptIn

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="border-2 border-[#123c2f] bg-white p-6 shadow-[6px_6px_0_#d8cab0]">
          <p className="text-sm font-semibold text-stone-600">Loading account...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      {toast && <Toast message={toast.message} tone={toast.tone} />}
      <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Account settings</p>
      <h1 className="mb-3 font-display text-4xl font-bold tracking-[-0.03em] text-emerald-950">Account</h1>
      <p className="mb-6 max-w-xl leading-7 text-stone-600">
        This name becomes your default entry name when you join or create a new pool. You can still rename a single pool entry from My Team.
      </p>

      <form onSubmit={handleSave} className="space-y-5 border-2 border-[#123c2f] bg-white p-6 shadow-[6px_6px_0_#d8cab0]">
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Default entry name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="w-full rounded-none border border-stone-300 bg-white px-4 py-3 text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Email</label>
          <input
            type="email"
            value={email}
            readOnly
            className="w-full rounded-none border border-stone-200 bg-stone-50 px-4 py-3 text-stone-600"
          />
          <p className="mt-1 text-xs text-stone-500">Email changes are not enabled yet.</p>
        </div>

        <label className="flex items-start gap-3 border border-stone-200 bg-[#fbf7ed] p-3 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={marketingOptIn}
            onChange={e => setMarketingOptIn(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-600"
          />
          <span>Send me Golf Pools Pro product updates and tournament reminders.</span>
        </label>

        <button
          type="submit"
          disabled={saving || !dirty || !name.trim()}
          className="w-full border-2 border-[#123c2f] bg-[#123c2f] px-4 py-3 font-bold text-white transition-colors hover:bg-[#0f2f25] disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save settings'}
        </button>
      </form>
    </div>
  )
}
