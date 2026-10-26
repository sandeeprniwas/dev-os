import { NextResponse } from 'next/server'
import { readJson } from '@/lib/api/read-json'
import { requireAuth } from '@/lib/security/authGuard'
import { withApiHandler } from '@/lib/api/with-api-handler'
import { updateKeyTermValue } from '@/lib/services/key-term.service'
import { parseIdParam } from '@/lib/validation/params'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const PATCH = withApiHandler<{ id: string }>(async (request, { params }) => {
  const id = parseIdParam(params)
  const { supabase } = await requireAuth()
  const keyTerm = await updateKeyTermValue(supabase, id, await readJson(request))
  return NextResponse.json({ keyTerm })
})
