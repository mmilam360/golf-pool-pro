import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import AppHeader from '@/components/AppHeader'
import { getAllBlogPosts } from '@/lib/blog'

export const metadata: Metadata = {
  title: 'Tournament Pick Guides | Golf Pools Pro',
  description: 'Tournament pick guides for golf pools, including picks, rules, missed cuts, OB scoring, pool hosts, and players making weekly tournament picks.',
  alternates: { canonical: 'https://www.golfpoolspro.com/blog' },
}

type BlogIndexPageProps = {
  searchParams?: Promise<{ from?: string }>
}

export default async function BlogIndexPage({ searchParams }: BlogIndexPageProps) {
  const posts = getAllBlogPosts()
  const params = await searchParams
  const fromDashboard = params?.from === 'dashboard'
  const backHref = fromDashboard ? '/dashboard' : '/'
  const backLabel = fromDashboard ? 'Dashboard' : 'Back'
  const logoHref = fromDashboard ? '/dashboard' : '/'
  const primaryHref = fromDashboard ? '/pool/create' : '/signup'
  const primaryLabel = fromDashboard ? 'Create pool' : 'Create a pool'
  const postSuffix = fromDashboard ? '?from=dashboard' : ''

  return (
    <div className="min-h-screen scorecard-paper text-[#1f2a24]">
      {fromDashboard ? (
        <AppHeader />
      ) : (
        <header className="border-b border-[#d8cab0] bg-[#fbf7ed] px-5 py-4">
          <nav className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <Link href={logoHref} className="flex items-center" aria-label="Golf Pools Pro home">
              <Image unoptimized src="/brand/golf-pools-pro-wordmark.png" alt="Golf Pools Pro" width={1660} height={695} priority className="h-11 w-auto object-contain sm:h-14" />
            </Link>
            <div className="flex items-center gap-2">
              <Link href={backHref} className="border-2 border-[#123c2f] bg-[#fffdf8] px-3 py-2 text-sm font-extrabold text-[#123c2f] transition-colors hover:bg-white sm:px-4">{backLabel}</Link>
              <Link href={primaryHref} className="border-2 border-[#123c2f] bg-[#123c2f] px-4 py-2 text-sm font-extrabold text-white">{primaryLabel}</Link>
            </div>
          </nav>
        </header>
      )}

      <main className="mx-auto max-w-5xl px-5 py-12 md:py-16">
        <p className="w-fit border-y border-[#b58a3a] py-2 text-xs font-bold uppercase tracking-[0.22em] text-[#8a6724]">Tournament pick guides</p>
        <h1 className="mt-5 font-display text-4xl font-black leading-tight text-[#0f2f25] md:text-6xl">Tournament picks for golf pools.</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[#4f5b52]">Weekly picks, scoring notes, and pool strategy for hosts and players before the first tee time.</p>

        <div className="mt-10 grid gap-5">
          {posts.map(post => (
            <Link key={post.slug} href={`/blog/${post.slug}${postSuffix}`} className="block border-2 border-[#123c2f] bg-white p-6 shadow-[7px_7px_0_#d8cab0] transition-transform hover:-translate-y-0.5">
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
