#!/usr/bin/env node
import fs from 'node:fs'

function loadEnv(path) {
  if (!fs.existsSync(path)) return
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const [key, ...rest] = trimmed.split('=')
    if (!process.env[key]) process.env[key] = rest.join('=').trim().replace(/^["']|["']$/g, '')
  }
}

loadEnv('.env.local')
loadEnv('.env.production')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  Accept: 'application/json',
}

async function assertColumns(table, columns) {
  const params = new URLSearchParams({
    select: columns.join(','),
    limit: '0',
  })
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${params}`, { headers })
  if (!res.ok) {
    console.error(`${table} columns missing or unavailable:`)
    console.error(await res.text())
    process.exit(1)
  }
}

await assertColumns('gpp_entries', [
  'id',
  'user_id',
  'display_name',
  'full_name',
  'full_name_confirmed_at',
  'notification_email',
  'guest_entry_token_hash',
  'claimed_at',
])

await assertColumns('gpp_profiles', [
  'id',
  'display_name',
  'full_name',
  'full_name_confirmed_at',
  'email',
])

const rpcProbe = await fetch(`${supabaseUrl}/rest/v1/rpc/gpp_guest_join_payload`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_passcode: 'XXXXXX' }),
})
const rpcText = await rpcProbe.text()
if (rpcProbe.status === 404 || rpcText.includes('Could not find the function')) {
  console.error('Guest join RPC is missing:')
  console.error(rpcText)
  process.exit(1)
}

console.log('Guest entry DB preflight passed.')
