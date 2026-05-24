import type { Metadata } from 'next'
import { TournamentSeoPage } from '@/components/TournamentSeoPage'

export const metadata: Metadata = {
  title: 'Charles Schwab Challenge Pool Manager | Golf Pools Pro',
  description: 'Run a Charles Schwab Challenge golf pool with mobile picks, private invite links, clear OB scoring, live leaderboards, and a final results board.',
  alternates: { canonical: 'https://www.golfpoolspro.com/charles-schwab-challenge-pool' },
}

export default function CharlesSchwabChallengePoolPage() {
  return (
    <TournamentSeoPage
      tournamentName="Charles Schwab Challenge"
      poolType="Charles Schwab Challenge pool"
      description="Set up a Charles Schwab Challenge pool for Colonial, send one invite link, and let players make their picks from their phones. Golf Pools Pro handles scoring, missed-cut/OB rules, leaderboard updates, and the final results board."
      guideHref="/blog/2026-charles-schwab-challenge-pool-picks"
      guideLabel="Read the Charles Schwab pool guide"
    />
  )
}
