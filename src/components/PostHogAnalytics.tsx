'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { trackGppEvent } from '@/lib/posthog-events'

function isMarketingPath(pathname: string) {
  return !pathname.startsWith('/dashboard')
    && !pathname.startsWith('/manage-pools')
    && !pathname.startsWith('/pool/')
    && !pathname.startsWith('/account')
    && !pathname.startsWith('/login')
    && !pathname.startsWith('/signup')
    && !pathname.startsWith('/reset-password')
    && !pathname.startsWith('/forgot-password')
}

export function PostHogAnalytics() {
  const pathname = usePathname()

  useEffect(() => {
    trackGppEvent('$pageview')
    if (isMarketingPath(pathname)) {
      trackGppEvent('marketing_page_view')
    }
  }, [pathname])

  return null
}
