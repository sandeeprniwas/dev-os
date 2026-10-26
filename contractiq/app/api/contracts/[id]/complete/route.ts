import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/security/authGuard'
import { withApiHandler } from '@/lib/api/with-api-handler'
import { markReviewComplete } from '@/lib/services/contract.service'
import { parseIdParam } from '@/lib/validation/params'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withApiHandler<{ id: string }>(async (_request, { params }) => {
  const id = parseIdParam(params)
  const { user, supabase } = await requireAuth()
  await markReviewComplete(supabase, id, user.id)
  return new NextResponse(null, { status: 204 })
})
