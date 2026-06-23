import assert from 'node:assert/strict'
import { extractBrowserSupabaseContext, findAnonJwt, hostFromUrl, supabaseContextMismatchIssue } from '../src/lib/prod-audit-context.ts'

const anonPayload = Buffer.from(JSON.stringify({ iss: 'supabase', role: 'anon', exp: 2096480888 })).toString('base64url')
const servicePayload = Buffer.from(JSON.stringify({ iss: 'supabase', role: 'service_role', exp: 2096480888 })).toString('base64url')
const anon = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${anonPayload}.signature`
const service = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${servicePayload}.signature`
const bundle = `createClient("https://supabase.golfpoolspro.com","${anon}");ignored("${service}")`

assert.equal(hostFromUrl('https://supabase.golfpoolspro.com/auth/v1'), 'supabase.golfpoolspro.com')
assert.equal(findAnonJwt(bundle), anon)
assert.deepEqual(extractBrowserSupabaseContext(bundle), { supabaseUrl: 'https://supabase.golfpoolspro.com', anonKey: anon })
assert.equal(supabaseContextMismatchIssue('https://vjxsranlpcijvkoxnyvj.supabase.co', 'https://supabase.golfpoolspro.com')?.code, 'AUDIT_SUPABASE_CONTEXT_MISMATCH')
assert.equal(supabaseContextMismatchIssue('https://supabase.golfpoolspro.com', 'https://supabase.golfpoolspro.com'), null)

console.log('prod audit context checks passed')
