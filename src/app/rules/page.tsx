import Link from 'next/link'
import type { Metadata } from 'next'
import { BackButton } from '@/components/BackButton'

export const metadata: Metadata = {
  title: 'Golf Pool Rules and OB Scoring | Golf Pools Pro',
  description: 'Clear golf pool rules for picks, counted scores, missed cuts, OB scoring, final-nine tiebreakers, live leaderboards, and host payment timing.',
  alternates: { canonical: 'https://www.golfpoolspro.com/rules' },
}

export default function RulesPage() {
  return (
    <main className="min-h-screen scorecard-paper px-4 py-10 text-[#1f2a24] sm:px-6">
      <div className="mx-auto max-w-4xl">
        <BackButton fallbackHref="/dashboard" label="Back" />

        <section className="mt-2 border-2 border-[#123c2f] bg-white shadow-[7px_7px_0_#d8cab0]">
          <div className="border-b border-[#d8cab0] bg-[#123c2f] px-6 py-5 text-white">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f3df9c]">Pool rules</p>
            <h1 className="mt-2 text-3xl font-black">How Golf Pools Pro works</h1>
          </div>

          <div className="space-y-6 p-6 text-sm leading-6 text-stone-700 sm:p-8">
            <section>
              <h2 className="text-lg font-black text-[#0f2f25]">The short version</h2>
              <p className="mt-2">The pool runner creates a pool for a tournament and chooses how many golfers each entrant picks. Everyone makes picks before the pool locks. Once the tournament starts, Golf Pools Pro follows the leaderboard and totals each entry.</p>
            </section>

            <section className="grid gap-3 md:grid-cols-3">
              <div className="border border-[#d8cab0] bg-[#fbf7ed] p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8a6724]">1. Pick golfers</p>
                <p className="mt-2">Each entrant chooses the required number of golfers from the tournament field.</p>
              </div>
              <div className="border border-[#d8cab0] bg-[#fbf7ed] p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8a6724]">2. Best scores count</p>
                <p className="mt-2">The pool counts only the best scores set by the pool runner. Lower totals rank higher.</p>
              </div>
              <div className="border border-[#d8cab0] bg-[#fbf7ed] p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8a6724]">3. Follow the board</p>
                <p className="mt-2">After scoring starts, the leaderboard updates and shows each entry's counted golfers.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-black text-[#0f2f25]">Example</h2>
              <div className="mt-2 border-2 border-[#111] bg-[#f7f7f2] p-4 font-semibold text-[#111]">
                <p>A pool can be set up as pick 8 golfers, count the best 4 scores.</p>
                <p className="mt-2">If your golfers are -3, -1, E, +2, +4, +5, cut, and withdrawn, your counted score is -2 from the best four active scores: -3, -1, E, and +2.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-black text-[#0f2f25]">Pool types</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className="border border-[#d8cab0] bg-[#fbf7ed] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8a6724]">Open Field</p>
                  <p className="mt-2">Open field, no groups. Entrants pick from the full tournament field.</p>
                </div>
                <div className="border border-[#d8cab0] bg-[#fbf7ed] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8a6724]">Tiered Picks</p>
                  <p className="mt-2">Ranked by World Golf Ranking. Entrants pick the same number of golfers from each tier.</p>
                </div>
                <div className="border border-[#d8cab0] bg-[#fbf7ed] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8a6724]">Clubhouse Chaos</p>
                  <p className="mt-2">The field is randomly shuffled, then divided into groups. Everyone plays from the same shuffled board.</p>
                </div>
              </div>
              <div className="mt-3 border-2 border-[#111] bg-[#f7f7f2] p-4 text-[#111]">
                <p className="font-black uppercase tracking-[0.08em]">Tiered-pick example</p>
                <p className="mt-2 font-semibold">Setup: 6 tiers, 2 picks per tier, best 8 scores count.</p>
                <p className="mt-2">In Tiered Picks, Tier 1 might include Scheffler, McIlroy, Schauffele, and Rahm. Tier 2 might include Morikawa, Hovland, Fleetwood, and Cantlay.</p>
                <p className="mt-2">In a random pool, those names can be mixed across groups after the shuffle. The groups stay the same for everyone after they lock.</p>
                <p className="mt-2">Groups auto-lock Tuesday morning of tournament week when the field is available. The pool runner can also lock groups once the official field is posted.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-black text-[#0f2f25]">Out of bounds golfers</h2>
              <p className="mt-2">A golfer is out of bounds if he misses the cut, withdraws, does not start, or never posts a usable score. OB only matters when your entry needs that golfer to fill one of your counted spots.</p>
              <div className="mt-3 border-2 border-[#111] bg-[#f7f7f2] p-4 text-[#111]">
                <p className="font-black uppercase tracking-[0.08em]">Typical OB example</p>
                <p className="mt-2 font-semibold">Pool setup: pick 8 golfers, count the best 4. OB penalty: worst active counted score in the pool plus 2.</p>
                <p className="mt-2">Your entry has three active counted scores: -4, -2, and E. Your fourth needed golfer missed the cut.</p>
                <p className="mt-2">If the worst active counted score anywhere in the pool is +6, your OB stand-in becomes +8. That is +6 plus the 2-stroke OB penalty.</p>
                <p className="mt-2 font-black">Your counted total would be -4, -2, E, and +8 = +2.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-black text-[#0f2f25]">Tiebreakers</h2>
              <p className="mt-2">If two entries finish with the same counted total, Golf Pools Pro uses a scorecard-style tiebreaker.</p>
              <div className="mt-3 border-2 border-[#111] bg-[#f7f7f2] p-4 text-[#111]">
                <p className="font-black uppercase tracking-[0.08em]">Final-nine tiebreak</p>
                <p className="mt-2">We add up the final nine holes for each entry's counted golfers. Lower total wins the tie.</p>
                <p className="mt-2">If that does not break the tie, we keep going back 9 holes at a time: last 18, last 27, last 36, and so on until the tie breaks or there are no more completed holes to use.</p>
                <p className="mt-2">Only counted golfers are used. If your pool counts the best 4 scores, the tiebreak uses those same 4 golfers.</p>
                <p className="mt-2">If the entries are still tied after all available 9-hole blocks, they stay tied.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-black text-[#0f2f25]">Pick privacy</h2>
              <p className="mt-2">Before the pool locks, entrants can see who joined, but other entrants' golfer picks stay hidden. Once the pool locks or the tournament starts, picks can show on the leaderboard.</p>
            </section>

            <div className="flex flex-col gap-3 border-t border-[#d8cab0] pt-6 sm:flex-row">
              <Link href="/pool/create" className="border-2 border-[#123c2f] bg-[#123c2f] px-5 py-3 text-center text-sm font-black uppercase text-white hover:bg-[#0f2f25]">Create pool</Link>
              <Link href="/pool/join" className="border-2 border-[#123c2f] bg-white px-5 py-3 text-center text-sm font-black uppercase text-[#123c2f] hover:bg-[#eef7ef]">Join pool</Link>
            </div>
          </div>
        </section>
        <p className="mt-6 text-center text-xs text-[#657168]">© {new Date().getFullYear()} Golf Pools Pro. All rights reserved.</p>
      </div>
    </main>
  )
}
