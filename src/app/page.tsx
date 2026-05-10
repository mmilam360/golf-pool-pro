import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4 tracking-tight">Golf Pool Pro</h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            Run your own golf pools for any PGA Tour event. Pick your team, track live scores, and settle up.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {[
            { title: 'Create a Pool', desc: 'Pick a tournament, set your rules, share the passcode.' },
            { title: 'Pick Your Team', desc: 'Choose 12 golfers. Best 8 scores count. Optional OB rule keeps everyone alive.' },
            { title: 'Live Leaderboards', desc: 'Real-time scores from PGA Tour events. Watch standings update live.' },
          ].map(f => (
            <div key={f.title} className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-zinc-400 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-4 justify-center">
          <Link href="/signup" className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-8 py-3 rounded-lg transition-colors">Get Started</Link>
          <Link href="/login" className="bg-zinc-800 hover:bg-zinc-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors">Sign In</Link>
        </div>
      </div>
    </div>
  )
}
