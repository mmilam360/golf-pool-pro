'use client'

import { useEffect, useMemo, useState } from 'react'

type NotificationPrefs = {
  pick_deadline?: boolean
  leaderboard_live?: boolean
  took_lead?: boolean
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i += 1) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export function NotificationSettings({
  initialPrefs,
  onChange,
}: {
  initialPrefs: NotificationPrefs
  onChange: (prefs: NotificationPrefs) => void
}) {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported')
  const [prefs, setPrefs] = useState<NotificationPrefs>(initialPrefs || {})

  useEffect(() => {
    if (!('Notification' in window)) {
      setPermission('unsupported')
      return
    }
    setPermission(Notification.permission)
  }, [])

  const enabled = permission === 'granted'
  const statusText = useMemo(() => {
    if (permission === 'unsupported') return 'Notifications are not supported on this browser.'
    if (permission === 'granted') return 'Notifications are on for this browser.'
    if (permission === 'denied') return 'Notifications are blocked in your browser settings.'
    return 'Turn on notifications before choosing reminder types.'
  }, [permission])

  async function registerPushSubscription(nextPrefs: NotificationPrefs) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('Push notifications are not supported on this browser.')
    }
    const keyResponse = await fetch('/api/notifications/subscribe')
    const { publicKey } = await keyResponse.json()
    if (!publicKey) throw new Error('Notification keys are not configured yet.')
    const registration = await navigator.serviceWorker.register('/sw.js')
    const existing = await registration.pushManager.getSubscription()
    const subscription = existing || await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
    const response = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: subscription.toJSON(), prefs: nextPrefs }),
    })
    if (!response.ok) throw new Error('Could not save notification settings.')
  }

  async function enableNotifications() {
    if (!('Notification' in window)) return
    const nextPermission = await Notification.requestPermission()
    setPermission(nextPermission)
    if (nextPermission === 'granted') {
      const next = {
        ...prefs,
        pick_deadline: true,
        leaderboard_live: true,
        took_lead: prefs.took_lead ?? false,
      }
      try {
        await registerPushSubscription(next)
        setPrefs(next)
        onChange(next)
        new Notification('Golf Pools Pro notifications are on', {
          body: 'Pick deadline reminders are ready on this device.',
          tag: 'gpp-test',
        })
      } catch (error) {
        setPermission(Notification.permission)
        window.alert(error instanceof Error ? error.message : 'Could not enable notifications on this device.')
      }
    }
  }

  function update(key: keyof NotificationPrefs, checked: boolean) {
    const next = { ...prefs, [key]: checked }
    setPrefs(next)
    onChange(next)
  }

  return (
    <div className="border border-[#d8cab0] bg-[#fbf7ed] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8a6724]">Notifications</p>
          <h2 className="mt-1 text-xl font-black text-[#123c2f]">Pool reminders</h2>
          <p className="mt-1 text-sm font-semibold text-[#657168]">{statusText}</p>
        </div>
        {permission !== 'granted' && permission !== 'unsupported' ? (
          <button
            type="button"
            onClick={enableNotifications}
            className="border-2 border-[#123c2f] bg-[#123c2f] px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-white hover:bg-[#0f2f25]"
          >
            Turn on
          </button>
        ) : null}
      </div>
      <div className={`mt-4 space-y-2 ${enabled ? '' : 'opacity-45'}`}>
        <label className="flex items-center justify-between gap-3 border border-[#d8cab0] bg-white px-3 py-2 text-sm font-bold text-[#1f2a24]">
          <span>Pick deadline reminders</span>
          <input type="checkbox" disabled={!enabled} checked={Boolean(prefs.pick_deadline)} onChange={event => update('pick_deadline', event.target.checked)} className="h-4 w-4 accent-[#123c2f]" />
        </label>
        <label className="flex items-center justify-between gap-3 border border-[#d8cab0] bg-white px-3 py-2 text-sm font-bold text-[#1f2a24]">
          <span>Leaderboard is live</span>
          <input type="checkbox" disabled={!enabled} checked={Boolean(prefs.leaderboard_live)} onChange={event => update('leaderboard_live', event.target.checked)} className="h-4 w-4 accent-[#123c2f]" />
        </label>
        <label className="flex items-center justify-between gap-3 border border-[#d8cab0] bg-white px-3 py-2 text-sm font-bold text-[#1f2a24]">
          <span>When I take the lead</span>
          <input type="checkbox" disabled={!enabled} checked={Boolean(prefs.took_lead)} onChange={event => update('took_lead', event.target.checked)} className="h-4 w-4 accent-[#123c2f]" />
        </label>
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 text-[#657168]">iPhone may require installing Golf Pools Pro to your Home Screen first.</p>
    </div>
  )
}
