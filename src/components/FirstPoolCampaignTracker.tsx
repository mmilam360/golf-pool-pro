'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { trackGppEvent } from '@/lib/posthog-events'

type CampaignCtaProps = {
  href: string
  location: string
  children: React.ReactNode
  className?: string
  campaign?: string
  eventPrefix?: string
}

type CampaignTrackerProps = {
  campaign?: string
  eventPrefix?: string
}

export function FirstPoolCampaignTracker({ campaign = 'first_pool_9_fb', eventPrefix = 'first_pool_9' }: CampaignTrackerProps = {}) {
  useEffect(() => {
    trackGppEvent(`${eventPrefix}_landing_view`, { campaign })

    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-campaign-section]'))
    const seen = new Set<string>()
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const section = entry.target.getAttribute('data-campaign-section')
          if (!section || seen.has(section)) continue
          seen.add(section)
          trackGppEvent(`${eventPrefix}_section_view`, {
            campaign,
            section,
          })
        }
      },
      { threshold: 0.45 }
    )

    sections.forEach(section => observer.observe(section))
    return () => observer.disconnect()
  }, [campaign, eventPrefix])

  return null
}

export function FirstPoolCampaignLink({ href, location, children, className, campaign = 'first_pool_9_fb', eventPrefix = 'first_pool_9' }: CampaignCtaProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackGppEvent(`${eventPrefix}_cta_clicked`, { campaign, location })}
    >
      {children}
    </Link>
  )
}
