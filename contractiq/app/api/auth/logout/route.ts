import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api/with-api-handler'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Server-side sign-out: revokes the refresh token and clears the session cookies on this response. */
export const POST = withApiHandler(async () => {
  const { error } = await createClient().auth.signOut()
  if (error) logger.warn('sign_out_failed', { code: error.code, status: error.status })
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
})
