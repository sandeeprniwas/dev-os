import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/security/authGuard'
import { withApiHandler } from '@/lib/api/with-api-handler'
import { readJson } from '@/lib/api/read-json'
import { replaceCustomTerms } from '@/lib/services/custom-terms.service'
import { parseIdParam } from '@/lib/validation/params'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const PUT = withApiHandler<{ id: string }>(async (request, { params }) => {
  const id = parseIdParam(params)
  const { supabase } = await requireAuth()
  const customTerms = await replaceCustomTerms(supabase, id, await readJson(request))
  return NextResponse.json({ customTerms })
})
