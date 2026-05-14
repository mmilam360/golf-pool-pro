import type { Metadata } from 'next'
import { TournamentSeoPage } from '@/components/TournamentSeoPage'

export const metadata: Metadata = {
  title: 'PGA Championship Pool Manager | Golf Pools Pro',
  description: 'Run a PGA Championship golf pool with online picks, private join links, automatic scoring, clear OB rules, and a live leaderboard.',
  alternates: { canonical: 'https://www.golfpoolspro.com/pga-championship-pool' },
}

export default function PgaChampionshipPoolPage() {
  return (
    <TournamentSeoPage
      tournamentName="PGA Championship"
      poolType="PGA Championship pool"
      description="Set up a PGA Championship pool, share the join link, let players make their own picks, and follow the standings without chasing a spreadsheet."
    />
  )
}
