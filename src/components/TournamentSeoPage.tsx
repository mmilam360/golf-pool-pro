import Link from 'next/link'

const features = [
  'Private join link and passcode for your group',
  'Players enter their own picks before lock',
  'Live leaderboard once tournament scoring starts',
  'OB scoring handles missed cuts and weaker picks automatically',
  'First 5 entries free, then $1 per extra active entry, capped at $25 through 100 entries',
]

export function TournamentSeoPage({
  tournamentName,
  poolType,
  description,
  guideHref,
  guideLabel,
}: {
  tournamentName: string
  poolType: string
  description: string
  guideHref?: string
  guideLabel?: string
}) {
  return (
    <div className="min-h-screen scorecard-paper text-[#1f2a24]">
      <header className="border-b border-[#d8cab0] bg-[#fbf7ed] px-5 py-4">
        <nav className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Link href="/" className="font-display text-xl font-black text-[#0f2f25]">Golf Pools Pro</Link>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-12 md:py-16">
        <p className="w-fit border-y border-[#b58a3a] py-2 text-xs font-bold uppercase tracking-[0.22em] text-[#8a6724]">{poolType}</p>
        <h1 className="mt-5 font-display text-4xl font-black leading-tight text-[#0f2f25] md:text-6xl">Run a {tournamentName} pool without a spreadsheet.</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[#4f5b52]">{description}</p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/signup" className="border-2 border-[#123c2f] bg-[#123c2f] px-6 py-3 text-center font-extrabold text-white">Create a pool</Link>
          {guideHref && guideLabel ? (
            <Link href={guideHref} className="border-2 border-[#123c2f] bg-[#fbf7ed] px-6 py-3 text-center font-extrabold text-[#123c2f]">{guideLabel}</Link>
          ) : (
            <Link href="/rules" className="border-2 border-[#123c2f] bg-[#fffdf8] px-6 py-3 text-center font-extrabold text-[#123c2f]">View rules</Link>
          )}
        </div>

        <section className="mt-12 grid gap-8 md:grid-cols-[1fr_1fr]">
          <div className="border-2 border-[#123c2f] bg-white p-6 shadow-[7px_7px_0_#d8cab0]">
            <h2 className="font-display text-3xl font-black text-[#0f2f25]">Built for real pool runners</h2>
            <ul className="mt-5 space-y-3 text-[#4f5b52]">
              {features.map(feature => (
                <li key={feature} className="border-b border-[#e7dcc7] pb-3 font-semibold last:border-b-0 last:pb-0">{feature}</li>
              ))}
            </ul>
          </div>

          <div className="border-2 border-[#123c2f] bg-[#fbf7ed] p-6 shadow-[7px_7px_0_#d8cab0]">
            <h2 className="font-display text-3xl font-black text-[#0f2f25]">How pricing works</h2>
            <p className="mt-4 leading-7 text-[#4f5b52]">Small pools can run free. Bigger pools stay predictable: the host pays $1 for each active entry after the first 5, capped at $25 through 100 entries. Very large pools add $15 for each started 100 entries after that, with a $99 max.</p>
            <p className="mt-4 border-t border-[#d8cab0] pt-4 text-sm font-bold uppercase tracking-[0.08em] text-[#005b3c]">Example: 18 active entries costs $13.</p>
          </div>
        </section>
      </main>
    </div>
  )
}
