import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const PROTECTED_PREFIXES = ['/dashboard', '/contracts', '/chat', '/settings', '/profile']
const AUTH_PAGES = ['/login', '/signup', '/forgot-password']

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request)
  const { pathname, search } = request.nextUrl

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  if (isProtected && !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname + search)
    return NextResponse.redirect(loginUrl)
  }

  if (AUTH_PAGES.includes(pathname) && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  // API routes authenticate themselves (401 JSON), so they are excluded from redirects.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)'],
}
