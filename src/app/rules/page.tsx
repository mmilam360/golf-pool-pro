import Link from 'next/link'

export default function RulesPage() {
  return (
    <main className="min-h-screen scorecard-paper px-4 py-10 text-[#1f2a24] sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm font-semibold text-emerald-800 hover:underline">Golf Pools Pro</Link>

        <section className="mt-6 border-2 border-[#123c2f] bg-white shadow-[7px_7px_0_#d8cab0]">
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
              <h2 className="text-lg font-black text-[#0f2f25]">Out of bounds golfers</h2>
              <p className="mt-2">A golfer is out of bounds when he misses the cut, withdraws, does not start, or does not have a usable score when your entry needs him. If that OB golfer is needed to fill your counted scores, Golf Pools Pro adds a stand-in score based on the worst active score plus the pool's OB penalty.</p>
              <p className="mt-2 border border-[#d8cab0] bg-[#fbf7ed] px-3 py-2 text-xs font-semibold text-[#1f2a24]">Example: if the pool counts 4 golfers and you only have 3 active golfers left, the fourth counted spot becomes the worst active score in the pool plus the OB penalty.</p>
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
      </div>
    </main>
  )
}
