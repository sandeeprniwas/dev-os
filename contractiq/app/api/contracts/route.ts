import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/security/authGuard'
import { withApiHandler } from '@/lib/api/with-api-handler'
import { getContractsPage } from '@/lib/services/stats.service'
import { parseContractsQueryStrict } from '@/lib/security/inputValidator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withApiHandler(async (request) => {
  const { supabase } = await requireAuth()
  const query = parseContractsQueryStrict(request.nextUrl.searchParams)
  return NextResponse.json(await getContractsPage(supabase, query))
})
