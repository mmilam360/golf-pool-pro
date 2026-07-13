import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const protectedPaths = ['/dashboard', '/pool/create', '/manage-pools', '/account']
  const isProtected = protectedPaths.some(p => pathname.startsWith(p))
  if (!isProtected) return NextResponse.next()

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

  if (!user) {
    const url = new URL('/login', request.url)
    const redirectTo = `${pathname}${request.nextUrl.search}`
    url.searchParams.set('redirect', redirectTo)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/manage-pools/:path*',
    '/account/:path*',
    '/pool/create/:path*',
  ],
}
