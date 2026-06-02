'use client'

import { useEffect, useState } from 'react'
import { BackButton } from '@/components/BackButton'
import { NotificationSettings } from '@/components/NotificationSettings'
import { createClient } from '@/lib/supabase/client'

type Tone = 'success' | 'error' | 'info'
type InstallPlatform = 'ios' | 'android'

type NotificationPrefs = { pick_deadline: boolean; leaderboard_live: boolean; took_lead: boolean }

type AccountClientProps = {
  initialEmail: string
  initialName: string
  initialMarketingOptIn: boolean
  initialNotificationPrefs: NotificationPrefs
}

const installSteps = {
  ios: [
    'Open Golf Pools Pro in Safari on your iPhone.',
    'Tap the Share button in the Safari toolbar.',
    'Scroll the share sheet and tap Add to Home Screen.',
    'Tap Add. Open Golf Pools Pro from the new home-screen icon.',
  ],
  android: [
    'Open Golf Pools Pro in Chrome on your Android phone.',
    'Tap the three-dot menu in the top-right corner.',
    'Tap Add to Home screen or Install app.',
    'Confirm the install. Open Golf Pools Pro from the new home-screen icon.',
  ],
}

function PwaInstallInstructions() {
  const [platform, setPlatform] = useState<InstallPlatform>('ios')
  const steps = installSteps[platform]

  return (
    <div className="mt-5 border-2 border-[#123c2f] bg-white p-5 shadow-[6px_6px_0_#d8cab0]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8a6724]">Install the app</p>
          <h2 className="mt-1 text-xl font-black text-[#123c2f]">Add Golf Pools Pro to your phone</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#657168]">
            Golf Pools Pro is a Progressive Web App. Install it from your browser so it opens like a normal app.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 border-2 border-[#123c2f] text-sm font-black uppercase tracking-[0.08em]">
        <button
          type="button"
          onClick={() => setPlatform('ios')}
          className={`border-r-2 border-[#123c2f] px-3 py-2 ${platform === 'ios' ? 'bg-[#123c2f] text-white' : 'bg-[#fbf7ed] text-[#123c2f]'}`}
        >
          iPhone
        </button>
        <button
          type="button"
          onClick={() => setPlatform('android')}
          className={`px-3 py-2 ${platform === 'android' ? 'bg-[#123c2f] text-white' : 'bg-[#fbf7ed] text-[#123c2f]'}`}
        >
          Android
        </button>
      </div>

      <ol className="mt-4 space-y-3">
        {steps.map((step, index) => (
          <li key={step} className="grid grid-cols-[32px_1fr] gap-3 text-sm font-semibold leading-6 text-[#1f2a24]">
            <span className="flex h-8 w-8 items-center justify-center border border-[#d8cab0] bg-[#fbf7ed] font-black text-[#8a6724]">{index + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-col gap-2 border-t border-[#d8cab0] pt-4 text-sm font-semibold text-[#657168] sm:flex-row sm:items-center sm:justify-between">
        <span>Official install help:</span>
        <div className="flex flex-wrap gap-3">
          <a href="https://support.apple.com/en-us/104996" target="_blank" rel="noreferrer" className="font-black text-[#123c2f] underline decoration-[#b58a3a] underline-offset-4">Apple iPhone</a>
          <a href="https://support.google.com/chrome/answer/9658361" target="_blank" rel="noreferrer" className="font-black text-[#123c2f] underline decoration-[#b58a3a] underline-offset-4">Chrome Android</a>
        </div>
      </div>
    </div>
  )
}

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

export default function AccountClient({ initialEmail, initialName, initialMarketingOptIn, initialNotificationPrefs }: AccountClientProps) {
  const supabase = createClient()
  const [email, setEmail] = useState(initialEmail)
  const [name, setName] = useState(initialName)
  const [originalName, setOriginalName] = useState(initialName)
  const [marketingOptIn, setMarketingOptIn] = useState(initialMarketingOptIn)
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>(initialNotificationPrefs)
  const [originalNotificationPrefs, setOriginalNotificationPrefs] = useState<NotificationPrefs>(initialNotificationPrefs)
  const [originalMarketingOptIn, setOriginalMarketingOptIn] = useState(initialMarketingOptIn)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; tone: Tone } | null>(null)

  useEffect(() => {
    setEmail(initialEmail)
    setName(initialName)
    setOriginalName(initialName)
    setMarketingOptIn(initialMarketingOptIn)
    setOriginalMarketingOptIn(initialMarketingOptIn)
    setNotificationPrefs(initialNotificationPrefs)
    setOriginalNotificationPrefs(initialNotificationPrefs)
  }, [initialEmail, initialName, initialMarketingOptIn, initialNotificationPrefs])

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
        notification_prefs: notificationPrefs,
      },
    })

    await fetch('/api/notifications/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefs: notificationPrefs }),
    }).catch(() => undefined)

    if (metadataError) {
      setToast({ message: 'Name saved, but account metadata did not update.', tone: 'info' })
    } else {
      setToast({ message: 'Account settings saved.', tone: 'success' })
    }

    setOriginalName(trimmedName)
    setOriginalMarketingOptIn(marketingOptIn)
    setOriginalNotificationPrefs(notificationPrefs)
    setSaving(false)
  }

  const notificationPrefsDirty = JSON.stringify(notificationPrefs) !== JSON.stringify(originalNotificationPrefs)
  const dirty = name.trim() !== originalName || marketingOptIn !== originalMarketingOptIn || notificationPrefsDirty

  return (
    <div className="mx-auto max-w-2xl">
      {toast && <Toast message={toast.message} tone={toast.tone} />}
      <BackButton />
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

        <NotificationSettings initialPrefs={notificationPrefs} onChange={setNotificationPrefs} />

        <button
          type="submit"
          disabled={saving || !dirty || !name.trim()}
          className="w-full border-2 border-[#123c2f] bg-[#123c2f] px-4 py-3 font-bold text-white transition-colors hover:bg-[#0f2f25] disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save settings'}
        </button>
      </form>

      <PwaInstallInstructions />
    </div>
  )
}
