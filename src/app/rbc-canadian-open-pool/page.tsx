import type { Metadata } from 'next'
import { TournamentSeoPage } from '@/components/TournamentSeoPage'

export const metadata: Metadata = {
  title: 'RBC Canadian Open Pool Manager | Golf Pools Pro',
  description: 'Run an RBC Canadian Open golf pool with phone-friendly picks, private invite links, automatic scoring, live leaderboards, and a shareable final board.',
  alternates: { canonical: 'https://www.golfpoolspro.com/rbc-canadian-open-pool' },
}

export default function RbcCanadianOpenPoolPage() {
  return (
    <TournamentSeoPage
      tournamentName="RBC Canadian Open"
      poolType="RBC Canadian Open pool"
      headlineArticle="an"
      description="Set up an RBC Canadian Open pool, send one invite link, and let players make picks from their phones. Golf Pools Pro handles scoring, missed-cut/OB rules, leaderboard updates, and the final results board."
    />
  )
}
