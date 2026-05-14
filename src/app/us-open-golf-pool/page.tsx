import type { Metadata } from 'next'
import { TournamentSeoPage } from '@/components/TournamentSeoPage'

export const metadata: Metadata = {
  title: 'U.S. Open Golf Pool Manager | Golf Pools Pro',
  description: 'Run a U.S. Open golf pool online with pick tracking, private join links, automatic scoring, OB handling, and live standings.',
  alternates: { canonical: 'https://www.golfpoolspro.com/us-open-golf-pool' },
}

export default function UsOpenGolfPoolPage() {
  return (
    <TournamentSeoPage
      tournamentName="U.S. Open"
      poolType="U.S. Open golf pool"
      description="Golf Pools Pro gives your U.S. Open pool a clean place for picks, rules, scoring, and live standings that everyone can check from their phone."
    />
  )
}
