import type { Metadata } from 'next'
import { TournamentSeoPage } from '@/components/TournamentSeoPage'

export const metadata: Metadata = {
  title: 'Travelers Championship Pool Manager | Golf Pools Pro',
  description: 'Run a Travelers Championship golf pool with phone-friendly picks, private invite links, automatic scoring, live leaderboards, and a shareable final board.',
  alternates: { canonical: 'https://www.golfpoolspro.com/travelers-championship-pool' },
}

export default function TravelersChampionshipPoolPage() {
  return (
    <TournamentSeoPage
      tournamentName="Travelers Championship"
      poolType="Travelers Championship pool"
      description="Set up a Travelers Championship pool, send one invite link, and let players make picks from their phones. Golf Pools Pro handles scoring, missed-cut/OB rules, leaderboard updates, and the final results board."
    />
  )
}
