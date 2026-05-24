'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { trackGppEvent } from '@/lib/posthog-events'

type CampaignCtaProps = {
  href: string
  location: string
  children: React.ReactNode
  className?: string
}

export function FirstPoolCampaignTracker() {
  useEffect(() => {
    trackGppEvent('first_pool_9_landing_view', { campaign: 'first_pool_9_fb' })

    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-campaign-section]'))
    const seen = new Set<string>()
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const section = entry.target.getAttribute('data-campaign-section')
          if (!section || seen.has(section)) continue
          seen.add(section)
          trackGppEvent('first_pool_9_section_view', {
            campaign: 'first_pool_9_fb',
            section,
          })
        }
      },
      { threshold: 0.45 }
    )

    sections.forEach(section => observer.observe(section))
    return () => observer.disconnect()
  }, [])

  return null
}

export function FirstPoolCampaignLink({ href, location, children, className }: CampaignCtaProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackGppEvent('first_pool_9_cta_clicked', { campaign: 'first_pool_9_fb', location })}
    >
      {children}
    </Link>
  )
}
