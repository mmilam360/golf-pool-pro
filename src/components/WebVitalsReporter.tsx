'use client'

import { useReportWebVitals } from 'next/web-vitals'
import { trackGppEvent } from '@/lib/posthog-events'

type ReportWebVitalsCallback = Parameters<typeof useReportWebVitals>[0]

function routeForAnalytics(pathname: string) {
  if (/^\/pool\/[^/]+\/poster$/.test(pathname)) return '/pool/[id]/poster'
  if (/^\/pool\/[^/]+$/.test(pathname)) return '/pool/[id]'
  if (/^\/leaderboard\/[^/]+$/.test(pathname)) return '/leaderboard/[id]'
  if (/^\/blog\/[^/]+$/.test(pathname)) return '/blog/[slug]'
  return pathname || '/'
}

function isStandalonePwa() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((window.navigator as any).standalone)
}

function roundedMetricValue(value: number, metricName: string) {
  const decimals = metricName === 'CLS' ? 4 : 0
  return Number(value.toFixed(decimals))
}

const reportWebVitals: ReportWebVitalsCallback = metric => {
  if (typeof window === 'undefined') return

  trackGppEvent('web_vital_reported', {
    metric_name: metric.name,
    metric_value: roundedMetricValue(metric.value, metric.name),
    metric_delta: roundedMetricValue(metric.delta, metric.name),
    metric_rating: metric.rating,
    metric_navigation_type: metric.navigationType,
    route: routeForAnalytics(window.location.pathname),
    standalone_pwa: isStandalonePwa(),
  }, { includePageProperties: false })
}

export function WebVitalsReporter() {
  useReportWebVitals(reportWebVitals)
  return null
}
