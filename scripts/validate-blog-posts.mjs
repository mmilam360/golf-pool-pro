#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const contentDir = path.join(root, 'src/content/blog')
const requiredStringFields = ['slug', 'title', 'description', 'publishedAt', 'author', 'category']

function fail(message) {
  console.error(`blog validation failed: ${message}`)
  process.exitCode = 1
}

function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

if (!fs.existsSync(contentDir)) {
  console.log('No blog content directory found.')
  process.exit(0)
}

const files = fs.readdirSync(contentDir).filter(file => file.endsWith('.json'))
const slugs = new Set()
const internalBlogLinks = []

function collectBlogLinksFromText(label, text) {
  const links = []
  const blogLinkPattern = /(?:https:\/\/www\.golfpoolspro\.com)?\/blog\/([a-z0-9-]+)/g
  for (const match of text.matchAll(blogLinkPattern)) {
    links.push({ label, slug: match[1] })
  }
  return links
}

for (const file of files) {
  const filePath = path.join(contentDir, file)
  let post
  try {
    post = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    fail(`${file} is not valid JSON: ${error.message}`)
    continue
  }

  for (const field of requiredStringFields) {
    if (typeof post[field] !== 'string' || post[field].trim().length === 0) {
      fail(`${file} missing required string field: ${field}`)
    }
  }

  if (post.slug && file !== `${post.slug}.json`) {
    fail(`${file} filename must match slug ${post.slug}.json`)
  }

  if (post.slug) {
    if (slugs.has(post.slug)) fail(`${file} duplicate slug: ${post.slug}`)
    slugs.add(post.slug)
  }

  if (post.publishedAt && !isDate(post.publishedAt)) fail(`${file} has invalid publishedAt`)
  if (post.updatedAt && !isDate(post.updatedAt)) fail(`${file} has invalid updatedAt`)

  if (!Array.isArray(post.sections) || post.sections.length < 3) {
    fail(`${file} needs at least 3 sections`)
  }

  for (const [index, section] of (post.sections || []).entries()) {
    if (!section.heading || !Array.isArray(section.body) || section.body.length === 0) {
      fail(`${file} section ${index + 1} needs heading and body paragraphs`)
    }
  }

  if (!post.heroCta || !post.heroCta.label || !post.heroCta.href?.startsWith('/')) {
    fail(`${file} needs a local heroCta`)
  }

  for (const link of post.internalLinks || []) {
    if (!link.href?.startsWith('/')) fail(`${file} internal link must be local: ${link.href}`)
    if (link.href?.startsWith('/blog/')) internalBlogLinks.push({ label: `${file} internalLinks`, slug: link.href.replace('/blog/', '') })
  }

  if (post.description && (post.description.length < 80 || post.description.length > 180)) {
    fail(`${file} description should be 80-180 chars`)
  }
}

const llmsRoutePath = path.join(root, 'src/app/llms.txt/route.ts')
if (fs.existsSync(llmsRoutePath)) {
  internalBlogLinks.push(...collectBlogLinksFromText('src/app/llms.txt/route.ts', fs.readFileSync(llmsRoutePath, 'utf8')))
}

for (const link of internalBlogLinks) {
  if (!slugs.has(link.slug)) fail(`${link.label} links to missing blog slug: ${link.slug}`)
}

if (!process.exitCode) {
  console.log(`Validated ${files.length} blog post${files.length === 1 ? '' : 's'}.`)
}
