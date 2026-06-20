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

function dashboardHasActivePools() {
  if (typeof document === 'undefined') return false
  return Boolean(document.querySelector('[data-dashboard-active-pools="true"]'))
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  )
}

function StepList({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="border-t border-[#d8cab0] pt-2">
      <p className="mb-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#005b3c]">{title}</p>
      <ol className="space-y-0.5 text-[10px] font-bold leading-4 text-stone-800">
        {steps.map((step, index) => <li key={step}>{index + 1}. {step}</li>)}
      </ol>
    </div>
  )
}

export function MobileInstallPrompt() {
  const pathname = usePathname()
  const [hash, setHash] = useState('')
  const [ready, setReady] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash)
    syncHash()
    window.addEventListener('hashchange', syncHash)
    return () => window.removeEventListener('hashchange', syncHash)
  }, [pathname])

  useEffect(() => {
    const editPicksRoute = /^\/pool\/[^/]+$/.test(pathname) && hash === '#make-picks'
    const shouldOfferInstall = !editPicksRoute && pathname === '/dashboard'
    const dismissedBefore = window.localStorage.getItem('gpp-install-dismissed') === 'true'
    setDismissed(dismissedBefore)

    const compactScreen = window.matchMedia('(max-width: 900px)').matches
    let showTimer: number | null = null
    const canShow = shouldOfferInstall && compactScreen && !dismissedBefore && !isStandalone() && !dashboardHasActivePools()
    if (canShow) {
      showTimer = window.setTimeout(() => {
        if (!dashboardHasActivePools()) setReady(true)
      }, 1500)
    } else {
      setReady(false)
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => {
      if (showTimer) window.clearTimeout(showTimer)
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    }
  }, [hash, pathname])

  const platform = useMemo(() => {
    if (typeof navigator === 'undefined') return 'other'
    const ua = navigator.userAgent.toLowerCase()
    if (/iphone|ipad|ipod/.test(ua)) return 'ios'
    if (/android/.test(ua)) return 'android'
    if (/chrome|crios|edg|brave|opr/.test(ua)) return 'chromium'
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
    <div className={`fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] right-3 z-50 max-w-[calc(100vw-1.5rem)] border-2 border-[#123c2f] bg-[#fbf7ed]/95 text-[#111] shadow-[3px_3px_0_#00442c] backdrop-blur ${expanded ? 'w-[21rem] p-3' : 'w-auto p-1.5'}`}>
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={() => setExpanded(value => !value)} className="flex min-w-0 flex-1 items-start gap-2 text-left" aria-expanded={expanded}>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-[#123c2f] bg-white text-[#123c2f]">
            <ChevronIcon expanded={expanded} />
          </span>
          <span className={`min-w-0 ${expanded ? '' : 'pr-1'}`}>
            <span className="block whitespace-nowrap font-display text-[11px] font-black uppercase tracking-[0.08em] text-[#005b3c]">Install app</span>
            {expanded ? <span className="block text-[11px] font-semibold leading-4 text-stone-700">Add Golf Pools Pro to your home screen.</span> : null}
          </span>
        </button>
        <button type="button" onClick={close} className="border border-[#111] bg-white px-2 py-1.5 text-[9px] font-black uppercase text-[#111]">
          Hide
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          {deferredPrompt && (
            <button type="button" onClick={install} className="w-full border-2 border-[#123c2f] bg-[#123c2f] py-2 text-[10px] font-black uppercase tracking-[0.08em] text-white">
              Install app
            </button>
          )}

          {(platform === 'ios' || platform === 'other') && (
            <StepList title="iPhone / iPad Safari" steps={['Tap the Share button in Safari.', 'Scroll and choose Add to Home Screen.', 'Tap Add.']} />
          )}

          {(platform === 'android' || platform === 'other') && (
            <StepList title="Android Chrome" steps={['Tap the three-dot menu in Chrome.', 'Choose Add to Home screen or Install app.', 'Tap Install or Add.']} />
          )}

          {(platform === 'chromium' || platform === 'other') && (
            <StepList title="Desktop Chrome / Edge" steps={['Open the browser menu or address-bar install icon.', 'Choose Install Golf Pools Pro.', 'Pin it to your dock or taskbar if you want.']} />
          )}
        </div>
      )}
    </div>
  )
}
