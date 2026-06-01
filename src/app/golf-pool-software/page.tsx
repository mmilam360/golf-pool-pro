import type { Metadata } from 'next'
import { SeoLandingPage } from '@/components/SeoLandingPage'

export const metadata: Metadata = {
  title: 'Golf Pool Software with Live Leaderboards | Golf Pools Pro',
  description: 'Run a golf pool online with private join links, player pick entry, automatic scoring, OB rules, and a live leaderboard for tournament week.',
  alternates: { canonical: 'https://www.golfpoolspro.com/golf-pool-software' },
}

export default function GolfPoolSoftwarePage() {
  return (
    <SeoLandingPage
      eyebrow="Golf pool software"
      title="Golf pool software people actually check."
      description="Create the pool, send one link, collect picks, and give everyone a live leaderboard worth refreshing from Thursday through Sunday."
      sections={[
        {
          title: 'Built for the commissioner job',
          body: 'Golf Pools Pro keeps setup, invites, picks, rules, scoring, and standings in one place so the pool runner is not rebuilding the weekend from texts and spreadsheets.',
        },
        {
          title: 'A board players come back to',
          body: 'Once scoring starts, the pool has a clean live board with player picks, counted scores, cut status, and the race at the top. It feels like tournament week, not office admin.',
        },
        {
          title: 'Simple pricing for real groups',
          body: 'The first 5 entries are free. Entries 6 through 100 are $1 each, capped at $20. Pools over 100 add $10 for each started 100-entry block.',
        },
      ]}
      bullets={[
        'Private join link and passcode',
        'Players enter their own picks',
        'Standard, ranked group, and Clubhouse Chaos formats',
        'Live scoring and pool standings',
        'Cut and OB rules handled automatically',
        'QR signup posters for the clubhouse, office, or group chat',
      ]}
    />
  )
}
