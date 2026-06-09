import Link from 'next/link'

type TalkingPoint = {
  title: string
  body: string
}

const features = [
  'Private join link and passcode for your group',
  'Players enter their own picks before lock',
  'Live leaderboard once tournament scoring starts',
  'OB scoring handles missed cuts and weaker picks automatically',
  'First 5 entries free, then $1 per extra active entry, capped at $20 through 100 entries',
]

export function TournamentSeoPage({
  tournamentName,
  poolType,
  description,
  venueName,
  venueLocation,
  tournamentDates,
  courseNotes = [],
  chatterNotes = [],
  guideHref,
  guideLabel,
}: {
  tournamentName: string
  poolType: string
  description: string
  venueName?: string
  venueLocation?: string
  tournamentDates?: string
  courseNotes?: TalkingPoint[]
  chatterNotes?: TalkingPoint[]
  guideHref?: string
  guideLabel?: string
}) {
  const hasEventDetails = venueName || venueLocation || tournamentDates
  const hasCourseNotes = courseNotes.length > 0
  const hasChatterNotes = chatterNotes.length > 0

  return (
    <div className="min-h-screen scorecard-paper text-[#1f2a24]">
      <header className="border-b border-[#d8cab0] bg-[#fbf7ed] px-5 py-4">
        <nav className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Link href="/" className="font-display text-xl font-black text-[#0f2f25]">Golf Pools Pro</Link>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-12 md:py-16">
        <p className="w-fit border-y border-[#b58a3a] py-2 text-xs font-bold uppercase tracking-[0.22em] text-[#8a6724]">{poolType}</p>
        <h1 className="mt-5 font-display text-4xl font-black leading-tight text-[#0f2f25] md:text-6xl">Run a {tournamentName} pool people actually check.</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[#4f5b52]">{description}</p>

        {hasEventDetails ? (
          <div className="mt-6 grid border-2 border-[#123c2f] bg-white shadow-[7px_7px_0_#d8cab0] sm:grid-cols-3">
            {venueName ? (
              <div className="border-b-2 border-[#123c2f] p-4 sm:border-b-0 sm:border-r-2">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a6724]">Course</p>
                <p className="mt-2 font-display text-2xl font-black leading-none text-[#0f2f25]">{venueName}</p>
              </div>
            ) : null}
            {venueLocation ? (
              <div className="border-b-2 border-[#123c2f] p-4 sm:border-b-0 sm:border-r-2">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a6724]">Host site</p>
                <p className="mt-2 font-display text-2xl font-black leading-none text-[#0f2f25]">{venueLocation}</p>
              </div>
            ) : null}
            {tournamentDates ? (
              <div className="p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a6724]">Tournament week</p>
                <p className="mt-2 font-display text-2xl font-black leading-none text-[#0f2f25]">{tournamentDates}</p>
              </div>
            ) : null}
          </div>
        ) : null}

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
            <p className="mt-4 leading-7 text-[#4f5b52]">Small pools can run free. Bigger pools stay predictable: the host pays $1 for each active entry after the first 5, capped at $20 through 100 entries. Pools over 100 entries add $10 for each started 100 entries after that.</p>
            <p className="mt-4 border-t border-[#d8cab0] pt-4 text-sm font-bold uppercase tracking-[0.08em] text-[#005b3c]">Example: 18 active entries costs $13. A 160-entry pool costs $30.</p>
          </div>
        </section>

        {hasCourseNotes || hasChatterNotes ? (
          <section className="mt-12 grid gap-8 md:grid-cols-2">
            {hasCourseNotes ? (
              <div className="border-2 border-[#123c2f] bg-white p-6 shadow-[7px_7px_0_#d8cab0]">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8a6724]">Course talking points</p>
                <h2 className="mt-3 font-display text-3xl font-black text-[#0f2f25]">Give the pool some Shinnecock flavor.</h2>
                <div className="mt-5 divide-y divide-[#e7dcc7]">
                  {courseNotes.map(note => (
                    <div key={note.title} className="py-4 first:pt-0 last:pb-0">
                      <h3 className="font-black uppercase tracking-[0.06em] text-[#123c2f]">{note.title}</h3>
                      <p className="mt-2 leading-7 text-[#4f5b52]">{note.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {hasChatterNotes ? (
              <div className="border-2 border-[#123c2f] bg-[#fbf7ed] p-6 shadow-[7px_7px_0_#d8cab0]">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8a6724]">Pool chat fuel</p>
                <h2 className="mt-3 font-display text-3xl font-black text-[#0f2f25]">Built-in reasons to check the board.</h2>
                <div className="mt-5 divide-y divide-[#d8cab0]">
                  {chatterNotes.map(note => (
                    <div key={note.title} className="py-4 first:pt-0 last:pb-0">
                      <h3 className="font-black uppercase tracking-[0.06em] text-[#123c2f]">{note.title}</h3>
                      <p className="mt-2 leading-7 text-[#4f5b52]">{note.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  )
}
