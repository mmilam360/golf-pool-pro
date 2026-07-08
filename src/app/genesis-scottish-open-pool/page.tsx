import type { Metadata } from 'next'
import { TournamentSeoPage } from '@/components/TournamentSeoPage'

export const metadata: Metadata = {
  title: 'Genesis Scottish Open Pool Manager | Golf Pools Pro',
  description: 'Run a Genesis Scottish Open golf pool for The Renaissance Club with phone-friendly picks, automatic scoring, OB handling, and live standings.',
  alternates: { canonical: 'https://www.golfpoolspro.com/genesis-scottish-open-pool' },
}

const courseNotes = [
  {
    title: 'Links-style week before the Open',
    body: 'The Genesis Scottish Open puts your pool on The Renaissance Club in North Berwick, where wind, firm turf, and awkward bounces can change the board fast.',
  },
  {
    title: 'A strong field makes picks harder',
    body: 'This is not a thin warmup event. With stars and Open hopefuls in the same field, players can build safe cards and still find separators in the middle of the sheet.',
  },
  {
    title: 'Lock the pool before Thursday tee times',
    body: 'Open entries early, share the invite link, and let everyone tinker until picks lock. Once scoring starts, the live board gives the group one place to check all week.',
  },
]

const chatterNotes = [
  {
    title: 'Rory at The Renaissance Club',
    body: 'Rory McIlroy won this event at The Renaissance Club in 2023, so he will be one of the first names people ask about when they open the pick sheet.',
  },
  {
    title: 'Home-country pressure',
    body: 'Robert MacIntyre gives Scottish pools an obvious local angle. If he starts hot, the board gets loud fast.',
  },
  {
    title: 'Separator picks matter',
    body: 'When a pool has plenty of obvious stars, the middle picks decide who has a different card by Sunday. That is where a good live leaderboard keeps people checking.',
  },
]

export default function GenesisScottishOpenPoolPage() {
  return (
    <TournamentSeoPage
      tournamentName="Genesis Scottish Open"
      poolType="Genesis Scottish Open pool"
      description="Set up a Genesis Scottish Open pool, send one invite link, and let players make picks from their phones. Golf Pools Pro handles scoring, OB rules, leaderboard updates, and the final results board."
      venueName="The Renaissance Club"
      venueLocation="North Berwick, Scotland"
      tournamentDates="July 9-12, 2026"
      courseNotes={courseNotes}
      chatterNotes={chatterNotes}
      courseNotesHeading="Bring The Renaissance Club into the pool."
      guideHref="/blog/2026-genesis-scottish-open-pool-picks"
      guideLabel="Read the pick guide"
    />
  )
}
