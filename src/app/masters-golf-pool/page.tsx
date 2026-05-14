import type { Metadata } from 'next'
import { TournamentSeoPage } from '@/components/TournamentSeoPage'

export const metadata: Metadata = {
  title: 'Masters Golf Pool Manager | Golf Pools Pro',
  description: 'Run a Masters golf pool online with private join links, pick tracking, automatic scoring, OB rules, and a live leaderboard for your group.',
  alternates: { canonical: 'https://www.golfpoolspro.com/masters-golf-pool' },
}

export default function MastersGolfPoolPage() {
  return (
    <TournamentSeoPage
      tournamentName="Masters"
      poolType="Masters golf pool"
      description="Golf Pools Pro helps you collect picks, lock entries before tee time, and keep everyone pointed at one live leaderboard during Masters week."
    />
  )
}
