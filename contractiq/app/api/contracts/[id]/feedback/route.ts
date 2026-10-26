import { NextResponse } from 'next/server'
import { readJson } from '@/lib/api/read-json'
import { requireAuth } from '@/lib/security/authGuard'
import { withApiHandler } from '@/lib/api/with-api-handler'
import { upsertFeedback } from '@/lib/services/feedback.service'
import { parseIdParam } from '@/lib/validation/params'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withApiHandler<{ id: string }>(async (request, { params }) => {
  const contractId = parseIdParam(params)
  const { user, supabase } = await requireAuth()
  const feedback = await upsertFeedback(supabase, { userId: user.id, contractId, body: await readJson(request) })
  return NextResponse.json({ feedback })
})
