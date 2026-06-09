import type { Metadata } from 'next'
import { TournamentSeoPage } from '@/components/TournamentSeoPage'

export const metadata: Metadata = {
  title: 'U.S. Open Golf Pool at Shinnecock Hills | Golf Pools Pro',
  description: 'Run a 2026 U.S. Open golf pool for Shinnecock Hills with course-specific talking points, player pick entry, automatic scoring, OB handling, and live standings.',
  alternates: { canonical: 'https://www.golfpoolspro.com/us-open-golf-pool' },
}

const shinnecockNotes = [
  {
    title: 'Shinnecock is not a normal target-golf week',
    body: 'The 2026 U.S. Open is at Shinnecock Hills in Southampton, a links-style course on sandy, rolling Long Island ground. Wind, firm turf, and awkward angles should make the leaderboard feel alive fast.',
  },
  {
    title: 'The Redan hole gives every group chat a villain',
    body: 'Shinnecock\'s par-3 7th is the famous Redan. When a picked golfer gets bounced away from the flag, your pool has instant "I needed that par" material.',
  },
  {
    title: 'The course rewards more than driver speed',
    body: 'Rory McIlroy and Scottie Scheffler both made early scouting trips, according to the golf-news tracker. That is the exact kind of detail that makes picks feel smarter before Thursday.',
  },
]

const scraperChatter = [
  {
    title: 'Adam Scott watch',
    body: 'The golf-news tracker caught the Adam Scott storyline: 100 straight majors. Someone in every pool will talk themselves into the veteran pick. Make them live with it on the board.',
  },
  {
    title: 'Bryson and the AI swing bit',
    body: 'Bryson showing up after the "AI helped my swing" headlines is perfect pool-chat bait. If he starts hot, half the group becomes swing scientists by Friday.',
  },
  {
    title: 'Qualifier panic picks',
    body: 'Max Homa and Tony Finau were showing up in qualification-watch chatter. That is useful pre-tournament fuel for the guy who changes picks five minutes before lock.',
  },
]

export default function UsOpenGolfPoolPage() {
  return (
    <TournamentSeoPage
      tournamentName="U.S. Open"
      poolType="2026 U.S. Open golf pool"
      description="Build a U.S. Open pool around Shinnecock Hills instead of a generic scoreboard. Players get live standings, course-specific talking points, and enough pool-chat fuel to keep checking the board all week."
      venueName="Shinnecock Hills"
      venueLocation="Southampton, New York"
      tournamentDates="June 18-21, 2026"
      courseNotes={shinnecockNotes}
      chatterNotes={scraperChatter}
    />
  )
}
