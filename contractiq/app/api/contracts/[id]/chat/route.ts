import { NextResponse } from 'next/server'
import { describeAzureError } from '@/lib/azure'
import { readJson } from '@/lib/api/read-json'
import { normaliseError, withApiHandler } from '@/lib/api/with-api-handler'
import { PROCESS_DEADLINE_MS } from '@/lib/constants/limits'
import { hashUserId } from '@/lib/llm/client'
import { getLlmGateway } from '@/lib/llm/gateway'
import { requireAuth } from '@/lib/security/authGuard'
import { enforceRateLimit } from '@/lib/security/rateLimiter'
import { answerChat, getChatHistory, prepareChatTurn } from '@/lib/services/chat.service'
import { parseIdParam } from '@/lib/validation/params'
import type { ChatAnswerDTO, ChatErrorBody } from '@/types/api'

// Azure agent calls can take 20–30 s: Node.js runtime (not Edge) with a 60 s budget.
export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

type Params = { id: string }

export const GET = withApiHandler<Params>(async (_request, { params }) => {
  const id = parseIdParam(params)
  const { user, supabase } = await requireAuth()
  return NextResponse.json(await getChatHistory(supabase, id, user.id), { headers: { 'Cache-Control': 'private, no-store' } })
})

/** Returns the agent's answer as plain JSON. Validation / auth / limit errors use the standard envelope. */
export const POST = withApiHandler<Params>(async (request, { params, requestId }) => {
  const id = parseIdParam(params)
  const { user, supabase } = await requireAuth()
  const body = await readJson(request)
  await enforceRateLimit('chat', { userId: user.id })

  // Rejections here happen before the AI is called; the question is not saved.
  const turn = await prepareChatTurn(supabase, { userId: user.id, contractId: id, body })

  try {
    const answer: ChatAnswerDTO = await answerChat({
      db: supabase,
      llm: getLlmGateway(),
      userId: user.id,
      userHash: hashUserId(user.id),
      turn,
      deadline: Date.now() + PROCESS_DEADLINE_MS,
    })
    return NextResponse.json(answer, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    // The question was saved, so return its id for a retry, plus the real Azure error text for diagnosis.
    const appError = normaliseError(error)
    const azureError = describeAzureError(error)
    const errorBody: ChatErrorBody = {
      error: { code: appError.code, message: appError.message, requestId, ...(azureError ? { azureError } : {}) },
      userMessageId: turn.userMessage.id,
      sessionId: turn.sessionId,
    }
    return NextResponse.json(errorBody, { status: appError.status, headers: { 'Cache-Control': 'no-store' } })
  }
})
