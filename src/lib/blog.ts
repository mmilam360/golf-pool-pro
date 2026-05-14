import * as fs from 'node:fs'
import * as path from 'node:path'

export type BlogSource = {
  name: string
  url: string
}

export type BlogSection = {
  heading: string
  body: string[]
  bullets?: string[]
}

export type BlogPost = {
  slug: string
  title: string
  description: string
  publishedAt: string
  updatedAt?: string
  author: string
  category: string
  keywords: string[]
  heroCta: {
    label: string
    href: string
  }
  sections: BlogSection[]
  faqs?: Array<{
    question: string
    answer: string
  }>
  sources?: BlogSource[]
  internalLinks?: Array<{
    label: string
    href: string
  }>
  draft?: boolean
}

const contentDir = path.join(process.cwd(), 'src/content/blog')

function readPostFile(fileName: string): BlogPost {
  const fullPath = path.join(contentDir, fileName)
  return JSON.parse(fs.readFileSync(fullPath, 'utf8')) as BlogPost
}

export function getAllBlogPosts({ includeDrafts = false }: { includeDrafts?: boolean } = {}) {
  if (!fs.existsSync(contentDir)) return []

  return fs
    .readdirSync(contentDir)
    .filter(fileName => fileName.endsWith('.json'))
    .map(readPostFile)
    .filter(post => includeDrafts || !post.draft)
    .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
}

export function getBlogPost(slug: string) {
  return getAllBlogPosts().find(post => post.slug === slug) ?? null
}

export function getBlogSlugs() {
  return getAllBlogPosts().map(post => post.slug)
}
