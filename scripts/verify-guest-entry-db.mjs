#!/usr/bin/env node
import fs from 'node:fs'

function loadEnv(path) {
  if (!fs.existsSync(path)) return
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const [key, ...rest] = trimmed.split('=')
    if (!process.env[key]) process.env[key] = rest.join('=').trim().replace(/^['"]|['"]$/g, '')
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

const columnProbe = await fetch(`${supabaseUrl}/rest/v1/gpp_entries?select=id,user_id,notification_email,guest_entry_token_hash,claimed_at&limit=0`, { headers })
if (!columnProbe.ok) {
  console.error('Guest entry columns missing or unavailable:')
  console.error(await columnProbe.text())
  process.exit(1)
}

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
