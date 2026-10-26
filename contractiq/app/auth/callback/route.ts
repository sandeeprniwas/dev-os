import { NextResponse, type NextRequest } from 'next/server'
import { safeRedirectPath } from '@/lib/auth/redirect'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Exchanges the email-confirmation (PKCE) code for a session, then redirects. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const code = url.searchParams.get('code')
  const next = safeRedirectPath(url.searchParams.get('next'))

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin))
    }
    logger.warn('auth_code_exchange_failed', { code: error.code, status: error.status })
  }

  return NextResponse.redirect(new URL('/login?error=link_expired', url.origin))
}
