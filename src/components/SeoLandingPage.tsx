import Link from 'next/link'

type SeoLandingSection = {
  title: string
  body: string
}

type SeoLandingPageProps = {
  eyebrow: string
  title: string
  description: string
  primaryCta?: string
  sections: SeoLandingSection[]
  bullets: string[]
}

export function SeoLandingPage({
  eyebrow,
  title,
  description,
  primaryCta = 'Create a pool',
  sections,
  bullets,
}: SeoLandingPageProps) {
  return (
    <div className="min-h-screen scorecard-paper text-[#1f2a24]">
      <header className="border-b border-[#d8cab0] bg-[#fbf7ed] px-5 py-4">
        <nav className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Link href="/" className="font-display text-xl font-black text-[#0f2f25]">Golf Pools Pro</Link>
          <Link href="/signup" className="border border-[#123c2f] bg-[#123c2f] px-4 py-2 text-sm font-extrabold text-white">Create pool</Link>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-12 md:py-16">
        <p className="w-fit border-y border-[#b58a3a] py-2 text-xs font-bold uppercase tracking-[0.22em] text-[#8a6724]">{eyebrow}</p>
        <h1 className="mt-5 max-w-4xl font-display text-4xl font-black leading-tight text-[#0f2f25] md:text-6xl">{title}</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[#4f5b52]">{description}</p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/signup" className="border-2 border-[#123c2f] bg-[#123c2f] px-6 py-3 text-center font-extrabold text-white">{primaryCta}</Link>
          <Link href="/rules" className="border-2 border-[#123c2f] bg-[#fffdf8] px-6 py-3 text-center font-extrabold text-[#123c2f]">View rules</Link>
        </div>

        <section className="mt-12 grid gap-8 md:grid-cols-[0.95fr_1.05fr] md:items-start">
          <div className="border-2 border-[#123c2f] bg-white p-6 shadow-[7px_7px_0_#d8cab0]">
            <h2 className="font-display text-3xl font-black text-[#0f2f25]">What you get</h2>
            <ul className="mt-5 space-y-3 text-[#4f5b52]">
              {bullets.map(bullet => (
                <li key={bullet} className="border-b border-[#e7dcc7] pb-3 font-semibold last:border-b-0 last:pb-0">{bullet}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-5">
            {sections.map(section => (
              <section key={section.title} className="border-2 border-[#123c2f] bg-[#fbf7ed] p-6 shadow-[7px_7px_0_#d8cab0]">
                <h2 className="font-display text-2xl font-black text-[#0f2f25]">{section.title}</h2>
                <p className="mt-3 leading-7 text-[#4f5b52]">{section.body}</p>
              </section>
            ))}
          </div>
        </section>

        <section className="mt-12 border-2 border-[#123c2f] bg-[#0f2f25] p-6 text-white shadow-[7px_7px_0_#d8cab0] md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#f3df9c]">Tournament week ready</p>
          <h2 className="mt-3 font-display text-3xl font-black md:text-4xl">Send the link before Thursday. Let the board carry the weekend.</h2>
          <p className="mt-4 max-w-3xl leading-7 text-[#f3ead7]">Players make their own picks, entries lock automatically before the first tee time Thursday, and everyone has one place to check standings when the cut line starts moving.</p>
        </section>
      </main>
    </div>
  )
}
