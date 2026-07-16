import { readFileSync, existsSync } from 'node:fs'

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    process.exitCode = 1
  }
}

const proxyPath = 'src/proxy.ts'
assert(existsSync(proxyPath), 'src/proxy.ts exists for Supabase SSR session refresh')
const proxy = readFileSync(proxyPath, 'utf8')

assert(proxy.includes("createServerClient") && proxy.includes("@supabase/ssr"), 'proxy uses Supabase SSR server client')
assert(/export\s+async\s+function\s+proxy\s*\(/.test(proxy), 'proxy exports Next.js 16 proxy function')
assert(proxy.includes('await supabase.auth.getUser()'), 'proxy calls auth.getUser() to refresh expired sessions')
assert(proxy.includes('request.cookies.getAll()'), 'proxy reads incoming auth cookies')
assert(proxy.includes('request.cookies.set(name, value)'), 'proxy mirrors refreshed cookies onto the forwarded request')
assert(proxy.includes('response.cookies.set(name, value, options)'), 'proxy writes refreshed cookies onto the response')
assert(proxy.includes("'/dashboard/:path*'") && proxy.includes("'/pool/:path*'") && proxy.includes("'/account/:path*'"), 'proxy covers authenticated app routes')
assert(!proxy.includes("'/api/:path*'"), 'proxy does not run on API/cron routes')

const serverClient = readFileSync('src/lib/supabase/server.ts', 'utf8')
assert(serverClient.includes('getAll()') && serverClient.includes('setAll(cookiesToSet)'), 'server Supabase client keeps getAll/setAll cookie support')

const browserClient = readFileSync('src/lib/supabase/client.ts', 'utf8')
assert(browserClient.includes('createBrowserClient'), 'browser Supabase client uses @supabase/ssr browser storage')

if (!process.exitCode) console.log('Auth session persistence checks passed')
