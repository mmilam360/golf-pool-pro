import type { Metadata } from 'next'
import { SeoLandingPage } from '@/components/SeoLandingPage'

export const metadata: Metadata = {
  title: 'Easy Office Pools Alternative for Golf Pools | Golf Pools Pro',
  description: 'Looking for a golf-focused pool manager? Golf Pools Pro gives groups online picks, live scoring, clear rules, and a tournament-style leaderboard.',
  alternates: { canonical: 'https://www.golfpoolspro.com/easy-office-pools-alternative' },
}

export default function EasyOfficePoolsAlternativePage() {
  return (
    <SeoLandingPage
      eyebrow="Golf pool alternative"
      title="A golf-focused way to run your next pool."
      description="If your group wants a cleaner tournament-week experience, Golf Pools Pro keeps picks, rules, scoring, and the live board built around golf from the start."
      sections={[
        {
          title: 'Golf comes first',
          body: 'Pool formats, pick counts, cut rules, OB scoring, tee-time locks, and leaderboard views are built around golf pools instead of a generic pool template.',
        },
        {
          title: 'Good for players, not just admins',
          body: 'Players get a simple join flow and a board they can check all weekend. That matters if you want people back for the next major.',
        },
        {
          title: 'Start small, scale up',
          body: 'Run a small group free, then grow into larger office, clubhouse, or buddy-trip pools with predictable host pricing after picks lock.',
        },
      ]}
      bullets={[
        'Online join links and passcodes',
        'Mobile pick entry',
        'Golf-specific scoring rules',
        'Live PGA leaderboard data',
        'Open Picks, Tiered Picks, and Clubhouse Chaos formats',
        'Signup posters with QR codes',
      ]}
      relatedLinks={[{ href: '/best-golf-pool-sites', label: 'Compare top golf pool sites' }]}
    />
  )
}
