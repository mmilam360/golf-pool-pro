import type { Metadata } from 'next'
import { TournamentSeoPage } from '@/components/TournamentSeoPage'

export const metadata: Metadata = {
  title: 'Open Championship Pool Manager | Golf Pools Pro',
  description: 'Run an Open Championship golf pool online with private join links, player pick entry, automatic scoring, OB rules, and live standings.',
  alternates: { canonical: 'https://www.golfpoolspro.com/open-championship-pool' },
}

export default function OpenChampionshipPoolPage() {
  return (
    <TournamentSeoPage
      tournamentName="Open Championship"
      poolType="Open Championship pool"
      headlineArticle="an"
      description="Golf Pools Pro helps your group make picks, lock entries before tee time, and follow one live board through the Open Championship weekend."
    />
  )
}
