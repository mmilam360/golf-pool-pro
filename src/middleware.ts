import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  const protectedPaths = ['/dashboard', '/pool/create', '/pool/join']
  const isProtected = protectedPaths.some(p => request.nextUrl.pathname.startsWith(p))
  if (!user && isProtected) {
    const url = new URL('/login', request.url)
    const redirectTo = `${request.nextUrl.pathname}${request.nextUrl.search}`
    url.searchParams.set('redirect', redirectTo)
    return NextResponse.redirect(url)
  }
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
    const redirectParam = request.nextUrl.searchParams.get('redirect')
    if (redirectParam && !redirectParam.includes('\\')) {
      try {
        const redirectUrl = new URL(redirectParam, request.url)
        if (redirectUrl.origin === request.nextUrl.origin && redirectUrl.pathname.startsWith('/')) {
          return NextResponse.redirect(redirectUrl)
        }
      } catch {}
    }
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  return response
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] }
