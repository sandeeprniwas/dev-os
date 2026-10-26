import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Public liveness probe for Uptime Robot and the frontend maintenance banner. */
export async function GET() {
  const time = new Date().toISOString()
  try {
    const admin = createAdminClient()
    if (admin) {
      const { error } = await admin.from('profiles').select('id').limit(1)
      if (error) throw error
    } else {
      const { error } = await createClient().auth.getSession()
      if (error) throw error
    }
    return NextResponse.json({ status: 'ok', db: 'ok', time }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const { code, message } = (error ?? {}) as { code?: string; message?: string }
    logger.error('health_check_failed', { code, errorMessage: message })
    return NextResponse.json(
      { status: 'degraded', db: 'down', time },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
