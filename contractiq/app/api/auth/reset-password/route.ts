import { NextResponse } from 'next/server'
import { readJson } from '@/lib/api/read-json'
import { withApiHandler } from '@/lib/api/with-api-handler'
import { fromAuthError } from '@/lib/auth/supabase-auth-errors'
import { requireAuth } from '@/lib/security/authGuard'
import { resetPasswordSchema } from '@/lib/security/inputValidator'
import { enforceRateLimit } from '@/lib/security/rateLimiter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Sets a new password for the session created by the password-recovery link. */
export const POST = withApiHandler(async (request) => {
  const { user, supabase } = await requireAuth()
  await enforceRateLimit('auth', { userId: user.id })
  const { password } = resetPasswordSchema.parse(await readJson(request))

  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw fromAuthError(error)

  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
})
