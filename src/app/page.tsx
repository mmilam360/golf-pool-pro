import Link from 'next/link'

export default function Home() {
  const rows = [
    ['1', 'A. Palmer', '-8', 'Tee time 8:20'],
    ['2', 'N. Player', '-6', 'Best 8 counting'],
    ['3', 'L. Trevino', '-5', 'Cut line safe'],
    ['4', 'J. Nicklaus', '-4', '2 picks live'],
  ]

  return (
    <div className="min-h-screen bg-[#f7f3ea] text-stone-900">
      <main className="max-w-6xl mx-auto px-6 py-16 md:py-20">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center mb-16">
          <section>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700 mb-4">Clubhouse pools for tournament week</p>
            <h1 className="text-5xl md:text-6xl font-bold mb-5 tracking-tight text-emerald-950">Golf Pool Pro</h1>
            <p className="text-stone-700 text-lg max-w-2xl leading-8">
              Run a golf pool for any PGA Tour event. Set the rules, invite your group, follow the board, and settle the purse.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <Link href="/signup" className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-7 py-3 rounded-lg transition-colors text-center shadow-sm">Create a Pool</Link>
              <Link href="/login" className="bg-white hover:bg-stone-50 text-emerald-900 font-semibold px-7 py-3 rounded-lg border border-stone-300 transition-colors text-center">Sign In</Link>
            </div>
          </section>

          <section className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-stone-200 bg-emerald-800 px-5 py-4 text-white">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-emerald-100">Sunday Board</p>
                <h2 className="text-xl font-semibold">Pool Leaderboard</h2>
              </div>
              <div className="rounded-md bg-amber-200 px-3 py-1 text-sm font-bold text-amber-950">Round 4</div>
            </div>
            <div className="grid grid-cols-[56px_1fr_72px_1fr] border-b border-stone-200 bg-stone-50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              <span>Rank</span>
              <span>Captain</span>
              <span>Score</span>
              <span>Status</span>
            </div>
            <div className="divide-y divide-stone-100">
              {rows.map(row => (
                <div key={row[0]} className="grid grid-cols-[56px_1fr_72px_1fr] items-center px-5 py-4 text-sm">
                  <span className="font-mono text-stone-500">{row[0]}</span>
                  <span className="font-semibold text-stone-900">{row[1]}</span>
                  <span className="font-mono font-bold text-emerald-800">{row[2]}</span>
                  <span className="text-stone-600">{row[3]}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-px bg-stone-200 text-center text-sm">
              {['12 picks', '8 scores', '$40 buy-in'].map(stat => (
                <div key={stat} className="bg-amber-50 px-3 py-4 font-semibold text-stone-800">{stat}</div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {[
            { title: 'Create a Pool', desc: 'Pick a tournament, set your rules, share the passcode.' },
            { title: 'Pick Your Team', desc: 'Choose 12 golfers. Best 8 scores count. Optional OB rule keeps everyone alive.' },
            { title: 'Follow the Board', desc: 'Track tournament scores and pool standings as the week moves.' },
          ].map(f => (
            <div key={f.title} className="bg-white rounded-lg p-6 border border-stone-200 shadow-sm">
              <h3 className="text-lg font-semibold mb-2 text-emerald-950">{f.title}</h3>
              <p className="text-stone-600 text-sm leading-6">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
