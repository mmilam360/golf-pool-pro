const baseUrl = (process.env.GPP_SMOKE_URL || process.argv[2] || 'https://www.golfpoolspro.com').replace(/\/$/, '')
const cookie = process.env.GPP_SMOKE_COOKIE || ''
const paths = ['/', '/login', '/dashboard', '/manage-pools']

function fail(message) {
  console.error(message)
  process.exitCode = 1
}

for (const path of paths) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: 'manual',
    headers: cookie ? { Cookie: cookie } : {},
  })
  const body = await response.text()
  const location = response.headers.get('location') || ''
  const isProtectedPath = ['/dashboard', '/manage-pools'].includes(path)
  const isAllowedAnonymousRedirect = !cookie && isProtectedPath && response.status >= 300 && response.status < 400 && location.startsWith('/login')
  const hasNextError = body.includes('__next_error__') || body.includes('Application error') || /digest['\"]?\s*[:=]/i.test(body)

  console.log(`${response.status} ${path}${location ? ` -> ${location}` : ''}`)

  if (isAllowedAnonymousRedirect) {
    continue
  }

  if (cookie && isProtectedPath && (response.status < 200 || response.status >= 300)) {
    fail(`Smoke check failed: authenticated ${path} returned HTTP ${response.status}${location ? ` -> ${location}` : ''}.`)
  } else if (response.status >= 300 && response.status < 400) {
    fail(`Smoke check failed: ${path} unexpectedly redirected to ${location || '(missing location)'}.`)
  } else if (response.status >= 500 || hasNextError) {
    fail(`Smoke check failed: ${path} returned an app/server error.`)
  } else if (response.status >= 400) {
    fail(`Smoke check failed: ${path} returned HTTP ${response.status}.`)
  }
}

if (!cookie) {
  console.warn('\nWARNING: GPP_SMOKE_COOKIE is not set, so authenticated dashboard rendering was not tested.')
  console.warn('Set GPP_SMOKE_COOKIE to a real logged-in session cookie before promoting during live tournaments.')
}

if (process.exitCode) process.exit(process.exitCode)
console.log('\nSmoke checks passed.')
