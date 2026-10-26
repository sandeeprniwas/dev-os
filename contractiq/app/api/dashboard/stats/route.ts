import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/security/authGuard'
import { withApiHandler } from '@/lib/api/with-api-handler'
import { getDashboardStats } from '@/lib/services/stats.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withApiHandler(async () => {
  const { supabase } = await requireAuth()
  return NextResponse.json(await getDashboardStats(supabase), { headers: { 'Cache-Control': 'private, no-store' } })
})
