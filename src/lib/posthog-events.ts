'use client'

type EventProperties = Record<string, string | number | boolean | null | undefined>

const POSTHOG_KEY = 'phc_CkiRNbAVW5a2GJGn5RknbcShJGWRFr6M4S6tkB2YTMGz'
const POSTHOG_HOST = 'https://us.i.posthog.com'
const DISTINCT_ID_KEY = 'gpp_posthog_distinct_id'

export type GppAnalyticsEvent =
  | '$pageview'
  | 'marketing_page_view'
  | 'first_pool_9_landing_view'
  | 'first_pool_9_section_view'
  | 'first_pool_9_cta_clicked'
  | 'first_pool_9_compare_slider_changed'
  | 'create_pool_clicked'
  | 'pool_created'
  | 'invite_link_copied'
  | 'entry_started'
  | 'entry_submitted'
  | 'payment_started'
  | 'payment_completed'
  | 'final_share_downloaded'

function currentPageProperties(): EventProperties {
  if (typeof window === 'undefined') return {}

  const params = new URLSearchParams(window.location.search)
  return {
    landing_page: window.location.pathname,
    page_path: `${window.location.pathname}${window.location.search}`,
    page_location: window.location.href,
    $current_url: window.location.href,
    $pathname: window.location.pathname,
    $title: document.title,
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    utm_content: params.get('utm_content'),
    utm_term: params.get('utm_term'),
  }
}

function getDistinctId() {
  const existing = window.localStorage.getItem(DISTINCT_ID_KEY)
  if (existing) return existing

  const next = window.crypto?.randomUUID?.() || `gpp_${Date.now()}_${Math.random().toString(16).slice(2)}`
  window.localStorage.setItem(DISTINCT_ID_KEY, next)
  return next
}

export function buildGppAnalyticsProperties(properties: EventProperties = {}) {
  return {
    ...currentPageProperties(),
    ...properties,
  }
}

export function trackGppEvent(event: GppAnalyticsEvent, properties: EventProperties = {}) {
  if (typeof window === 'undefined') return

  const distinctId = getDistinctId()
  const payload = {
    api_key: POSTHOG_KEY,
    event,
    distinct_id: distinctId,
    properties: {
      distinct_id: distinctId,
      ...buildGppAnalyticsProperties(properties),
    },
  }

  window.fetch(`${POSTHOG_HOST}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {})
}
