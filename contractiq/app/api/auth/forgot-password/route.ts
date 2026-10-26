import { NextResponse } from 'next/server'
import { readJson } from '@/lib/api/read-json'
import { withApiHandler } from '@/lib/api/with-api-handler'
import { publicEnv } from '@/lib/public-env'
import { forgotPasswordSchema } from '@/lib/security/inputValidator'
import { clientIp, enforceRateLimit } from '@/lib/security/rateLimiter'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Sends a password-reset link. Always reports success so the response never reveals which emails exist. */
export const POST = withApiHandler(async (request) => {
  await enforceRateLimit('auth', { ip: clientIp(request) })
  const { email } = forgotPasswordSchema.parse(await readJson(request))

  const { error } = await createClient().auth.resetPasswordForEmail(email, {
    redirectTo: `${publicEnv.appUrl}/auth/callback?next=/reset-password`,
  })
  if (error) logger.warn('password_reset_request_failed', { code: error.code, status: error.status })

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
})
