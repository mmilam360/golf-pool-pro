import Image from 'next/image'
import Link from 'next/link'

const leaderboardRows = [
  { rank: '1', name: 'Miller group', thru: 'F', total: '-38', picks: ['-9', '-7', '-6', '-5', '-4'] },
  { rank: '2', name: 'Sunday pins', thru: '17', total: '-35', picks: ['-8', '-6', '-6', '-4', '-3'] },
  { rank: '3', name: 'Lake nine', thru: '16', total: '-33', picks: ['-7', '-7', '-5', '-4', '-2'] },
  { rank: '4', name: 'Fairway room', thru: '15', total: '-31', picks: ['-8', '-5', '-5', '-3', 'E'] },
]

const setupSteps = [
  ['01', 'Set the format', 'Choose the tournament, pick count, and scoring rules.'],
  ['02', 'Send the code', 'Players join from their phone and enter their picks.'],
  ['03', 'Check standings', 'Follow one leaderboard as tournament scores update.'],
]

export default function Home() {
  return (
    <div className="min-h-screen scorecard-paper text-[#1f2a24]">
      <header className="border-b border-[#d8cab0] bg-[#fbf7ed]/90 backdrop-blur-sm">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 md:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Golf Pool Pro home">
            <Image src="/brand/golf-pool-pro-wordmark.png" alt="Golf Pool Pro" width={328} height={101} priority className="h-8 w-auto object-contain sm:h-10 md:h-11" />
          </Link>
          <div className="flex shrink-0 items-center gap-2 text-xs font-semibold sm:text-sm">
            <Link href="/login" className="rounded-md border border-[#d8cab0] bg-white px-3 py-2 text-[#123c2f] transition-colors hover:bg-[#f7f0df] sm:px-4">
              Sign in
            </Link>
            <Link href="/signup" className="rounded-md bg-[#123c2f] px-3 py-2 text-white transition-colors hover:bg-[#0f2f25] sm:px-4">
              Create a pool
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl gap-10 px-4 pb-14 pt-10 sm:px-5 md:px-8 md:pb-20 md:pt-16 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div>
            <p className="mb-4 w-fit max-w-full border-y border-[#b58a3a] py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8a6724] sm:text-xs sm:tracking-[0.28em]">
              Golf pool manager
            </p>
            <h1 className="max-w-full font-display text-[3.25rem] font-bold leading-[0.94] tracking-[-0.045em] text-[#0f2f25] sm:text-6xl md:text-7xl">
              Run a golf pool your group can follow.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[#4f5b52] sm:text-lg sm:leading-8">
              Create a pool, share the code, collect picks, and track the standings in one place.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className="rounded-md bg-[#123c2f] px-6 py-3 text-center font-semibold text-white shadow-sm transition-colors hover:bg-[#0f2f25]">
                Create a pool
              </Link>
              <Link href="/login" className="rounded-md border border-[#cbb994] bg-white px-6 py-3 text-center font-semibold text-[#123c2f] transition-colors hover:bg-[#f7f0df]">
                View standings
              </Link>
            </div>
          </div>

          <div className="rounded-[18px] border border-[#cdbd9d] bg-white shadow-[0_24px_70px_rgba(31,42,36,0.14)]">
            <div className="flex items-center justify-between border-b border-[#d8cab0] bg-[#123c2f] px-5 py-4 text-white md:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#d7c99f]">Pool leaders</p>
                <h2 className="font-display text-2xl font-bold">PGA Championship pool</h2>
              </div>
              <div className="rounded-sm bg-[#f3df9c] px-3 py-2 text-sm font-black text-[#0f2f25]">R4</div>
            </div>

            <div className="md:hidden">
              <div className="grid grid-cols-[48px_1fr_54px_70px] border-b border-[#d8cab0] bg-[#fbf7ed] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#657168]">
                <span>Pos</span>
                <span>Entry</span>
                <span>Thru</span>
                <span>Total</span>
              </div>
              {leaderboardRows.map(row => (
                <div key={row.rank} className="grid grid-cols-[48px_1fr_54px_70px] items-center border-b border-[#eadfca] px-4 py-4 text-sm last:border-b-0">
                  <span className="font-mono text-[#657168]">{row.rank}</span>
                  <span className="font-semibold text-[#1f2a24]">{row.name}</span>
                  <span className="font-mono text-[#657168]">{row.thru}</span>
                  <span className="font-mono text-lg font-black text-[#1f6b4a]">{row.total}</span>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <div className="min-w-[680px]">
                <div className="grid grid-cols-[64px_1.3fr_70px_82px_repeat(5,58px)] border-b border-[#d8cab0] bg-[#fbf7ed] px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-[#657168]">
                  <span>Pos</span>
                  <span>Entry</span>
                  <span>Thru</span>
                  <span>Total</span>
                  <span>G1</span>
                  <span>G2</span>
                  <span>G3</span>
                  <span>G4</span>
                  <span>G5</span>
                </div>
                {leaderboardRows.map(row => (
                  <div key={row.rank} className="grid grid-cols-[64px_1.3fr_70px_82px_repeat(5,58px)] items-center border-b border-[#eadfca] px-5 py-4 text-sm last:border-b-0">
                    <span className="font-mono text-[#657168]">{row.rank}</span>
                    <span className="font-semibold text-[#1f2a24]">{row.name}</span>
                    <span className="font-mono text-[#657168]">{row.thru}</span>
                    <span className="font-mono text-lg font-black text-[#1f6b4a]">{row.total}</span>
                    {row.picks.map((score, index) => (
                      <span key={`${row.rank}-${index}`} className="font-mono font-bold text-[#b93a32]">{score}</span>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 border-t border-[#d8cab0] bg-[#fbf7ed] text-center text-sm font-semibold text-[#1f2a24]">
              <div className="border-r border-[#d8cab0] px-4 py-4">12 picks</div>
              <div className="border-r border-[#d8cab0] px-4 py-4">Best 8 count</div>
              <div className="px-4 py-4">Live standings</div>
            </div>
          </div>
        </section>

        <section className="border-y border-[#d8cab0] bg-[#123c2f] text-white">
          <div className="mx-auto grid max-w-7xl gap-0 px-5 md:grid-cols-3 md:px-8">
            {setupSteps.map(step => (
              <div key={step[0]} className="border-b border-white/15 py-8 md:border-b-0 md:border-r md:px-8 md:last:border-r-0">
                <p className="mb-4 font-mono text-sm font-bold text-[#f3df9c]">{step[0]}</p>
                <h3 className="font-display text-2xl font-bold">{step[1]}</h3>
                <p className="mt-3 max-w-sm leading-7 text-[#d8e3dc]">{step[2]}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
          <div className="grid gap-8 rounded-[18px] border border-[#d8cab0] bg-white p-6 shadow-sm md:grid-cols-[1fr_auto] md:items-center md:p-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#8a6724]">Before the first tee time</p>
              <h2 className="mt-3 font-display text-3xl font-bold text-[#0f2f25] md:text-4xl">Set up the pool and send the code.</h2>
              <p className="mt-4 max-w-2xl leading-7 text-[#657168]">
                Players make their own picks. The standings page does the rest once scores are available.
              </p>
            </div>
            <Link href="/signup" className="rounded-md bg-[#123c2f] px-6 py-3 text-center font-semibold text-white transition-colors hover:bg-[#0f2f25]">
              Create pool
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
