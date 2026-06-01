import type { Metadata } from 'next'
import { SeoLandingPage } from '@/components/SeoLandingPage'

export const metadata: Metadata = {
  title: 'Live Golf Pool Leaderboard | Golf Pools Pro',
  description: 'Give your golf pool a live leaderboard with automatic scoring, counted picks, cut status, OB handling, and clear standings for every entry.',
  alternates: { canonical: 'https://www.golfpoolspro.com/live-golf-pool-leaderboard' },
}

export default function LiveGolfPoolLeaderboardPage() {
  return (
    <SeoLandingPage
      eyebrow="Live golf pool leaderboard"
      title="A golf pool leaderboard worth refreshing."
      description="Follow every entry, counted golfer, cut-line swing, and Sunday move from one live board built for golf pools."
      sections={[
        {
          title: 'Scores update with the tournament',
          body: 'Players can see where their picks stand without waiting for the pool runner to update a sheet or post screenshots in the group chat.',
        },
        {
          title: 'Counted picks stay clear',
          body: 'The board shows the golfers that matter for each entry, with scoring, status, and OB handling tied back to the pool rules.',
        },
        {
          title: 'Built for weekend drama',
          body: 'The leaderboard keeps the group checking back when the cut moves, a favorite makes a run, or the final few holes decide the pool.',
        },
      ]}
      bullets={[
        'Ranked pool standings',
        'Per-golfer scores and progress',
        'Cut and WD status support',
        'Best-count scoring for each entry',
        'Tie handling for final boards',
        'Mobile-friendly pool view',
      ]}
    />
  )
}
