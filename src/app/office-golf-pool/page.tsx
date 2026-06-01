import type { Metadata } from 'next'
import { SeoLandingPage } from '@/components/SeoLandingPage'

export const metadata: Metadata = {
  title: 'Office Golf Pool Manager | Golf Pools Pro',
  description: 'Run an office golf pool online with join links, player pick entry, live scoring, OB handling, and a leaderboard your group can check all weekend.',
  alternates: { canonical: 'https://www.golfpoolspro.com/office-golf-pool' },
}

export default function OfficeGolfPoolPage() {
  return (
    <SeoLandingPage
      eyebrow="Office golf pool"
      title="Your office golf pool should not feel like office software."
      description="Golf Pools Pro gives your group a clean place to join, make picks, check rules, and follow the live board during the tournament."
      sections={[
        {
          title: 'One link for the whole group',
          body: 'Send the pool link or passcode once. Players join on their phone, enter picks, and come back to the same board when scoring starts.',
        },
        {
          title: 'Less chasing, fewer arguments',
          body: 'Rules, pick counts, locked entries, missed cuts, and OB stand-ins are handled in the app. The commissioner does not have to explain the same thing all weekend.',
        },
        {
          title: 'Made for majors and weekly pools',
          body: 'Use it for a Masters pool, U.S. Open pool, PGA Championship pool, Open Championship pool, or any PGA Tour week your group cares about.',
        },
      ]}
      bullets={[
        'Fast setup for office and group text pools',
        'Pick entry from any phone',
        'Live leaderboard once the tournament starts',
        'Clear lock timing before the first tee time',
        'Reusable players when you run the next pool',
        'Host-paid pricing after entries lock',
      ]}
    />
  )
}
