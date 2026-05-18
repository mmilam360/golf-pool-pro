import type { Metadata } from 'next'
import { TournamentSeoPage } from '@/components/TournamentSeoPage'

export const metadata: Metadata = {
  title: 'CJ Cup Byron Nelson Pool Manager | Golf Pools Pro',
  description: 'Run a CJ Cup Byron Nelson golf pool with phone-friendly picks, private invite links, automatic scoring, live leaderboards, and a shareable final board.',
  alternates: { canonical: 'https://www.golfpoolspro.com/cj-cup-byron-nelson-pool' },
}

export default function CjCupByronNelsonPoolPage() {
  return (
    <TournamentSeoPage
      tournamentName="CJ Cup Byron Nelson"
      poolType="CJ Cup Byron Nelson pool"
      description="Set up a CJ Cup Byron Nelson pool, send one invite link, and let players make picks from their phones. Golf Pools Pro handles scoring, leaderboard updates, and the final results board. Use code CJCUP9 this week to run the pool for $9."
    />
  )
}
