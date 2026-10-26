import { NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/security/rateLimiter'
import { readJson } from '@/lib/api/read-json'
import { requireAuth } from '@/lib/security/authGuard'
import { sseStream } from '@/lib/api/stream'
import { withApiHandler } from '@/lib/api/with-api-handler'
import { PROCESS_DEADLINE_MS } from '@/lib/constants/limits'
import { hashUserId } from '@/lib/llm/client'
import { getLlmGateway } from '@/lib/llm/gateway'
import { getChatHistory, prepareChatTurn, streamChatAnswer } from '@/lib/services/chat.service'
import { parseIdParam } from '@/lib/validation/params'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 26

type Params = { id: string }

export const GET = withApiHandler<Params>(async (_request, { params }) => {
  const id = parseIdParam(params)
  const { user, supabase } = await requireAuth()
  return NextResponse.json(await getChatHistory(supabase, id, user.id), { headers: { 'Cache-Control': 'private, no-store' } })
})

export const POST = withApiHandler<Params>(async (request, { params }) => {
  const id = parseIdParam(params)
  const { user, supabase } = await requireAuth()
  const body = await readJson(request)
  await enforceRateLimit('chat', { userId: user.id })

  const turn = await prepareChatTurn(supabase, { userId: user.id, contractId: id, body })
  const deadline = Date.now() + PROCESS_DEADLINE_MS
  const llm = getLlmGateway()

  return sseStream((send) =>
    streamChatAnswer({ db: supabase, llm, userId: user.id, userHash: hashUserId(user.id), turn, send, deadline }),
  )
})
