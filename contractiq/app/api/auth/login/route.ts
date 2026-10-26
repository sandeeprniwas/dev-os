import { NextResponse } from 'next/server'
import { readJson } from '@/lib/api/read-json'
import { withApiHandler } from '@/lib/api/with-api-handler'
import { fromAuthError } from '@/lib/auth/supabase-auth-errors'
import { loginSchema } from '@/lib/security/inputValidator'
import { clientIp, enforceRateLimit } from '@/lib/security/rateLimiter'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Server-side sign-in: the session cookies are set on this response by the server Supabase client. */
export const POST = withApiHandler(async (request) => {
  await enforceRateLimit('auth', { ip: clientIp(request) })
  const { email, password } = loginSchema.parse(await readJson(request))

  const { error } = await createClient().auth.signInWithPassword({ email, password })
  if (error) throw fromAuthError(error)

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
})
