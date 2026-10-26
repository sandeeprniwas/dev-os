import { NextResponse } from 'next/server'
import { readJson } from '@/lib/api/read-json'
import { withApiHandler } from '@/lib/api/with-api-handler'
import { fromAuthError } from '@/lib/auth/supabase-auth-errors'
import { publicEnv } from '@/lib/public-env'
import { signupSchema } from '@/lib/security/inputValidator'
import { clientIp, enforceRateLimit } from '@/lib/security/rateLimiter'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Server-side sign-up. To prevent account enumeration, an already-registered email gets the same
 * "check your inbox" response as a new one (Supabase sends no email in that case).
 */
export const POST = withApiHandler(async (request) => {
  await enforceRateLimit('auth', { ip: clientIp(request) })
  const { email, password } = signupSchema.parse(await readJson(request))

  const { data, error } = await createClient().auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${publicEnv.appUrl}/auth/callback` },
  })
  if (error && error.code !== 'user_already_exists') throw fromAuthError(error)

  const status = data.session ? 'signed_in' : 'verify_email'
  return NextResponse.json({ status }, { headers: { 'Cache-Control': 'no-store' } })
})
