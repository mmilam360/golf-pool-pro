import type { MetadataRoute } from 'next'
import { getAllBlogPosts } from '@/lib/blog'
import { dateOnlyToUtcDate } from '@/lib/date-utils'

const siteUrl = 'https://www.golfpoolspro.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  const blogPosts = getAllBlogPosts()

  return [
    {
      url: siteUrl,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${siteUrl}/login`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${siteUrl}/signup`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${siteUrl}/rules`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${siteUrl}/masters-golf-pool`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${siteUrl}/pga-championship-pool`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${siteUrl}/cj-cup-byron-nelson-pool`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${siteUrl}/us-open-golf-pool`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${siteUrl}/blog`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    ...blogPosts.map(post => ({
      url: `${siteUrl}/blog/${post.slug}`,
      lastModified: dateOnlyToUtcDate(post.updatedAt || post.publishedAt) || lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.65,
    })),
    {
      url: `${siteUrl}/privacy`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${siteUrl}/terms`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
  ]
}
