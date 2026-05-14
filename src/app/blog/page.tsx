import Link from 'next/link'
import type { Metadata } from 'next'
import { getAllBlogPosts } from '@/lib/blog'

export const metadata: Metadata = {
  title: 'Golf Pool Guides | Golf Pools Pro',
  description: 'Useful golf pool guides for picks, rules, missed cuts, OB scoring, and running office golf pools without a spreadsheet.',
  alternates: { canonical: 'https://www.golfpoolspro.com/blog' },
}

export default function BlogIndexPage() {
  const posts = getAllBlogPosts()

  return (
    <div className="min-h-screen scorecard-paper text-[#1f2a24]">
      <header className="border-b border-[#d8cab0] bg-[#fbf7ed] px-5 py-4">
        <nav className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Link href="/" className="font-display text-xl font-black text-[#0f2f25]">Golf Pools Pro</Link>
          <Link href="/signup" className="border-2 border-[#123c2f] bg-[#123c2f] px-4 py-2 text-sm font-extrabold text-white">Create a pool</Link>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-12 md:py-16">
        <p className="w-fit border-y border-[#b58a3a] py-2 text-xs font-bold uppercase tracking-[0.22em] text-[#8a6724]">Golf pool guides</p>
        <h1 className="mt-5 font-display text-4xl font-black leading-tight text-[#0f2f25] md:text-6xl">Useful stuff for pool runners.</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[#4f5b52]">Picks, rules, scoring notes, and practical setup ideas for the person stuck running the group golf pool.</p>

        <div className="mt-10 grid gap-5">
          {posts.map(post => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="block border-2 border-[#123c2f] bg-white p-6 shadow-[7px_7px_0_#d8cab0] transition-transform hover:-translate-y-0.5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a6724]">{post.category} / {new Date(`${post.publishedAt}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
              <h2 className="mt-2 font-display text-3xl font-black leading-tight text-[#0f2f25]">{post.title}</h2>
              <p className="mt-3 max-w-3xl leading-7 text-[#4f5b52]">{post.description}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
