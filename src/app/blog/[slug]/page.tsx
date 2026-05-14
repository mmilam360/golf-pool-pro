import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getAllBlogPosts, getBlogPost } from '@/lib/blog'

const siteUrl = 'https://www.golfpoolspro.com'

type PageProps = {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return getAllBlogPosts().map(post => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const post = getBlogPost(slug)
  if (!post) return {}

  const url = `${siteUrl}/blog/${post.slug}`

  return {
    title: `${post.title} | Golf Pools Pro`,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.description,
      url,
      siteName: 'Golf Pools Pro',
      type: 'article',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt || post.publishedAt,
    },
  }
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params
  const post = getBlogPost(slug)
  if (!post) notFound()

  const url = `${siteUrl}/blog/${post.slug}`
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    author: { '@type': 'Organization', name: post.author },
    publisher: { '@type': 'Organization', name: 'Golf Pools Pro' },
    mainEntityOfPage: url,
    url,
  }
  const faqSchema = post.faqs?.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: post.faqs.map(item => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      }
    : null

  return (
    <div className="min-h-screen scorecard-paper text-[#1f2a24]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      {faqSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />}

      <header className="border-b border-[#d8cab0] bg-[#fbf7ed] px-5 py-4">
        <nav className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <Link href="/blog" className="font-bold text-[#123c2f] hover:underline">Back to guides</Link>
          <Link href="/signup" className="border-2 border-[#123c2f] bg-[#123c2f] px-4 py-2 text-sm font-extrabold text-white">Create a pool</Link>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-10 md:py-14">
        <article className="border-2 border-[#123c2f] bg-white p-5 shadow-[7px_7px_0_#d8cab0] md:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a6724]">{post.category} / {new Date(`${post.publishedAt}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          <h1 className="mt-3 font-display text-4xl font-black leading-tight text-[#0f2f25] md:text-6xl">{post.title}</h1>
          <p className="mt-5 text-lg leading-8 text-[#4f5b52]">{post.description}</p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href={post.heroCta.href} className="border-2 border-[#123c2f] bg-[#123c2f] px-5 py-3 text-center font-extrabold text-white">{post.heroCta.label}</Link>
            <Link href="/rules" className="border-2 border-[#123c2f] bg-[#fffdf8] px-5 py-3 text-center font-extrabold text-[#123c2f]">View scoring rules</Link>
          </div>

          <div className="mt-10 space-y-9">
            {post.sections.map(section => (
              <section key={section.heading}>
                <h2 className="font-display text-3xl font-black leading-tight text-[#0f2f25]">{section.heading}</h2>
                <div className="mt-4 space-y-4 text-base leading-8 text-[#3f4a43]">
                  {section.body.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
                </div>
                {section.bullets && (
                  <ul className="mt-4 space-y-2 border-l-4 border-[#b21e23] bg-[#fbf7ed] p-4 text-[#3f4a43]">
                    {section.bullets.map(item => <li key={item} className="font-semibold">{item}</li>)}
                  </ul>
                )}
              </section>
            ))}
          </div>

          {post.faqs && (
            <section className="mt-12 border-t-2 border-[#123c2f] pt-8">
              <h2 className="font-display text-3xl font-black text-[#0f2f25]">Quick answers</h2>
              <div className="mt-4 space-y-3">
                {post.faqs.map(item => (
                  <details key={item.question} className="border-2 border-[#123c2f] bg-[#fbf7ed] p-4">
                    <summary className="cursor-pointer font-black text-[#0f2f25]">{item.question}</summary>
                    <p className="mt-3 leading-7 text-[#4f5b52]">{item.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          {post.internalLinks && (
            <section className="mt-10 border-t-2 border-[#123c2f] pt-6">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[#8a6724]">Related</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {post.internalLinks.map(link => (
                  <Link key={link.href} href={link.href} className="border border-[#123c2f] bg-[#fffdf8] px-3 py-2 text-sm font-bold text-[#123c2f] hover:bg-white">{link.label}</Link>
                ))}
              </div>
            </section>
          )}

          {post.sources && (
            <section className="mt-10 border-t border-[#d8cab0] pt-6">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[#8a6724]">Sources checked</h2>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[#4f5b52]">
                {post.sources.map(source => (
                  <li key={source.url}><a href={source.url} className="font-semibold text-[#123c2f] underline" rel="noopener noreferrer" target="_blank">{source.name}</a></li>
                ))}
              </ul>
            </section>
          )}
        </article>
      </main>
    </div>
  )
}
