#!/usr/bin/env node
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'

function loadEnv(path) {
  const env = {}
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const [key, ...rest] = line.split('=')
    env[key] = rest.join('=').replace(/^['"]|['"]$/g, '')
  }
  return env
}

function arg(name, fallback) {
  const hit = process.argv.find(value => value.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

function code(prefix) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(8)
  let suffix = ''
  for (const byte of bytes) suffix += alphabet[byte % alphabet.length]
  return `${prefix}-${suffix.slice(0, 4)}-${suffix.slice(4, 8)}`
}

const count = Math.max(1, Math.min(500, Number(arg('count', '25')) || 25))
const prefix = String(arg('prefix', 'FIRSTPOOL')).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'FIRSTPOOL'
const description = arg('description', 'Free first pool')
const env = { ...process.env, ...loadEnv('.env.local') }
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase env. Run from repo root with .env.local present.')
  process.exit(1)
}

const codes = new Set()
while (codes.size < count) codes.add(code(prefix))

const rows = [...codes].map(value => ({
  code: value,
  description,
  free_pool: true,
  max_redemptions: 1,
  is_active: true,
}))

const res = await fetch(`${supabaseUrl}/rest/v1/gpp_promo_codes`, {
  method: 'POST',
  headers: {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation,resolution=ignore-duplicates',
  },
  body: JSON.stringify(rows),
})

if (!res.ok) {
  console.error(`Failed to create promo codes: ${res.status}`)
  console.error(await res.text())
  process.exit(1)
}

const created = await res.json()
console.log(created.map(row => row.code).join('\n'))
