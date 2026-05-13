'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((window.navigator as any).standalone)
}

export function MobileInstallPrompt() {
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const shouldOfferInstall = pathname === '/dashboard' || /^\/pool\/[^/]+$/.test(pathname)
    const dismissedBefore = window.localStorage.getItem('gpp-install-dismissed') === 'true'
    setDismissed(dismissedBefore)

    const mobile = window.matchMedia('(max-width: 768px)').matches
    setReady(shouldOfferInstall && mobile && !dismissedBefore && !isStandalone())

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [pathname])

  const platform = useMemo(() => {
    if (typeof navigator === 'undefined') return 'other'
    const ua = navigator.userAgent.toLowerCase()
    if (/iphone|ipad|ipod/.test(ua)) return 'ios'
    if (/android/.test(ua)) return 'android'
    return 'other'
  }, [])

  if (!ready || dismissed) return null

  const close = () => {
    window.localStorage.setItem('gpp-install-dismissed', 'true')
    setDismissed(true)
  }

  const install = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') close()
  }

  return (
    <div className="fixed bottom-3 right-3 z-50 w-[15.5rem] border border-[#111] bg-[#fbf7ed]/85 p-2 text-[#111] shadow-[3px_3px_0_#00442c] backdrop-blur transition-opacity hover:opacity-100 opacity-90">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setExpanded(value => !value)} className="min-w-0 text-left">
          <p className="font-display text-[10px] font-black uppercase tracking-[0.08em] text-[#005b3c]">Install app</p>
          <p className="text-[10px] font-semibold leading-3 text-stone-700">Keep the pool one tap away.</p>
        </button>
        <button type="button" onClick={close} className="border border-[#111] bg-white px-2 py-1 text-[9px] font-black uppercase">
          Hide
        </button>
      </div>

      {expanded && (platform === 'ios' ? (
        <ol className="mt-2 space-y-0.5 border-t border-[#d8cab0] pt-2 text-[10px] font-bold leading-4 text-stone-800">
          <li>1. Tap Share in Safari.</li>
          <li>2. Choose Add to Home Screen.</li>
          <li>3. Tap Add.</li>
        </ol>
      ) : (
        <div className="mt-2 space-y-2 border-t border-[#d8cab0] pt-2">
          <ol className="space-y-0.5 text-[10px] font-bold leading-4 text-stone-800">
            <li>1. Tap Install if your browser shows it.</li>
            <li>2. Or open the Chrome menu.</li>
            <li>3. Choose Add to Home screen.</li>
          </ol>
          {deferredPrompt && (
            <button type="button" onClick={install} className="w-full border-2 border-[#123c2f] bg-[#123c2f] py-2 text-[10px] font-black text-white">
              Install app
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
