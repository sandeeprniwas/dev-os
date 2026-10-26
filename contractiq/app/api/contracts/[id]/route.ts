import { NextResponse } from 'next/server'
import { AppError } from '@/lib/api/errors'
import { requireAuth } from '@/lib/security/authGuard'
import { withApiHandler } from '@/lib/api/with-api-handler'
import { deleteContract, getContractDetail } from '@/lib/services/contract.service'
import { parseIdParam } from '@/lib/validation/params'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { id: string }

export const GET = withApiHandler<Params>(async (_request, { params }) => {
  const id = parseIdParam(params)
  const { user, supabase } = await requireAuth()
  const detail = await getContractDetail(supabase, id, user.id)
  if (!detail) throw new AppError('NOT_FOUND')
  return NextResponse.json(detail, { headers: { 'Cache-Control': 'private, no-store' } })
})

export const DELETE = withApiHandler<Params>(async (_request, { params }) => {
  const id = parseIdParam(params)
  const { supabase } = await requireAuth()
  await deleteContract(supabase, id)
  return new NextResponse(null, { status: 204 })
})
