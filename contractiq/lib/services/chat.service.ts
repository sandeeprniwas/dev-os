import 'server-only'
import { AppError } from '@/lib/api/errors'
import { describeAzureError } from '@/lib/azure'
import { LLM_TIMEOUT_MS, MAX_CHAT_MESSAGES } from '@/lib/constants/limits'
import {
  getChatSession,
  getLatestChatMessage,
  getOrCreateChatSession,
  insertChatMessage,
  listChatMessages,
} from '@/lib/db/chat.repo'
import { listKeyTerms } from '@/lib/db/key-terms.repo'
import { logUsage } from '@/lib/db/llm-usage.repo'
import { toChatMessageDTO } from '@/lib/db/mappers'
import type { DbClient } from '@/lib/db/types'
import { ensurePrefix, extractCitedPages, isNotFoundAnswer } from '@/lib/llm/citations'
import { classifyQuery } from '@/lib/llm/classify-query'
import type { TokenUsage } from '@/lib/llm/cost'
import type { LlmGateway } from '@/lib/llm/gateway'
import { buildChatMessages } from '@/lib/llm/prompts/chat'
import { withRetry } from '@/lib/llm/with-retry'
import { verifyContractOwnership, verifySessionOwnership } from '@/lib/security/chatSecurity'
import { detectPromptInjection, guardModelOutput, sanitizeForLLM } from '@/lib/security/promptInjectionGuard'
import { assertMessageLength, getMaxChatHistory } from '@/lib/security/tokenLimiter'
import { requireAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/utils/logger'
import { chatPostSchema } from '@/lib/validation/chat'
import type { ChatAnswerDTO, ChatHistoryDTO } from '@/types/api'
import type { ChatMessageRow, ContractRow, KeyTermRow } from '@/types/domain'

export async function getChatHistory(db: DbClient, contractId: string, userId: string): Promise<ChatHistoryDTO> {
  await verifyContractOwnership(db, contractId, userId)
  const found = await getChatSession(db, contractId)
  if (!found) return { session: null, messages: [] }
  const session = verifySessionOwnership(found, userId, contractId)
  const messages = await listChatMessages(db, session.id, MAX_CHAT_MESSAGES)
  return { session: { id: session.id, messageCount: session.message_count }, messages: messages.map(toChatMessageDTO) }
}

export type PreparedChatTurn = {
  contract: ContractRow
  sessionId: string
  userMessage: ChatMessageRow
  history: ChatMessageRow[]
}

/**
 * Pre-stream work (returns JSON errors, never calls the AI on failure): validate and screen the message
 * for prompt injection, verify contract + session ownership (completed contracts only), enforce the
 * message limit, and persist the user's message (or reuse it on retry).
 */
export async function prepareChatTurn(
  db: DbClient,
  args: { userId: string; contractId: string; body: unknown },
): Promise<PreparedChatTurn> {
  const parsed = chatPostSchema.parse(args.body)
  assertMessageLength(parsed.message)
  const message = sanitizeForLLM(parsed.message, { field: 'message' })
  const { retryOfMessageId } = parsed

  const contract = await verifyContractOwnership(db, args.contractId, args.userId, { requireCompleted: true })
  const session = verifySessionOwnership(await getOrCreateChatSession(db, args.contractId), args.userId, args.contractId)

  let userMessage: ChatMessageRow | null = null
  if (retryOfMessageId) {
    const latest = await getLatestChatMessage(db, session.id)
    if (latest && latest.id === retryOfMessageId && latest.role === 'user' && latest.content === message) {
      userMessage = latest
    }
  }

  if (!userMessage) {
    if (session.message_count >= MAX_CHAT_MESSAGES - 1) throw new AppError('CHAT_LIMIT_REACHED')
    userMessage = await insertChatMessage(db, {
      session_id: session.id,
      user_id: args.userId,
      role: 'user',
      content: message,
      query_class: classifyQuery(message),
    })
  }

  const all = await listChatMessages(db, session.id, MAX_CHAT_MESSAGES)
  const history = all
    .filter((m) => m.id !== userMessage.id)
    // Defence in depth: user turns that would fail the injection screen (e.g. inserted around the API)
    // are never replayed to the model.
    .filter((m) => m.role === 'assistant' || !detectPromptInjection(m.content).detected)
    .slice(-getMaxChatHistory())
  return { contract, sessionId: session.id, userMessage, history }
}

/**
 * Asks the Azure agent for a grounded answer and persists it (contract-chat spec §6.2).
 * Throws AppError on failure (cause carries the Azure error). Saving the reply is best-effort:
 * if the write fails the answer is still returned with a null id.
 */
export async function answerChat(args: {
  db: DbClient
  llm: LlmGateway
  userId: string
  userHash: string
  turn: PreparedChatTurn
  deadline: number
}): Promise<ChatAnswerDTO> {
  const { db, llm, userId, userHash, turn, deadline } = args
  const startedAt = Date.now()
  let usage: TokenUsage | null = null
  let finishReason: string | null = null
  let attempts = 0

  let keyTerms: KeyTermRow[] = []
  try {
    keyTerms = await listKeyTerms(db, turn.contract.id)
  } catch (error) {
    logger.warn('chat_key_terms_unavailable', { contractId: turn.contract.id, error })
  }

  const { messages, droppedHistory } = buildChatMessages({
    title: turn.contract.title,
    contractType: turn.contract.contract_type,
    pageCount: turn.contract.page_count,
    contractText: turn.contract.contract_text,
    keyTerms: keyTerms.map((t) => ({ name: t.term_name, value: t.value, page: t.page_number })),
    history: turn.history,
    message: turn.userMessage.content,
    queryClass: classifyQuery(turn.userMessage.content),
  })
  if (droppedHistory > 0) logger.info('chat_history_truncated', { contractId: turn.contract.id, droppedHistory })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Math.max(1000, Math.min(LLM_TIMEOUT_MS, deadline - Date.now())))

  try {
    const { result } = await withRetry(
      async () => {
        attempts++
        return llm.completeChat({ messages, signal: controller.signal, memoryUserId: userHash })
      },
      { deadline },
    )
    finishReason = result.finishReason
    usage = result.usage

    if (result.refusal || finishReason === 'content_filter') throw new AppError('LLM_REFUSED')
    const full = result.content ?? ''
    if (!full.trim()) throw new AppError('LLM_UNAVAILABLE', 'The AI agent returned an empty answer. Try again.')

    const guarded = guardModelOutput(full)
    if (!guarded.safe) logger.warn('chat_output_blocked', { contractId: turn.contract.id })
    const content = guarded.safe ? ensurePrefix(full) : guarded.text
    const citedPages = isNotFoundAnswer(content) ? [] : extractCitedPages(content, turn.contract.page_count)
    const latencyMs = Date.now() - startedAt

    // Assistant messages are server-authored only (clients may insert role='user' rows exclusively).
    let assistantMessageId: string | null = null
    try {
      const assistant = await insertChatMessage(requireAdminClient(), {
        session_id: turn.sessionId,
        user_id: userId,
        role: 'assistant',
        content: content.slice(0, 8000),
        cited_pages: citedPages,
        latency_ms: latencyMs,
      })
      assistantMessageId = assistant.id
    } catch (error) {
      logger.error('chat_assistant_save_failed', { contractId: turn.contract.id, error })
    }

    await logUsage({
      userId,
      contractId: turn.contract.id,
      operation: 'chat',
      model: llm.model,
      usage,
      latencyMs,
      attempts: Math.max(1, attempts),
      success: true,
      finishReason,
    })

    return {
      userMessageId: turn.userMessage.id,
      sessionId: turn.sessionId,
      assistantMessageId,
      assistantMessage: content,
      citedPages,
      latencyMs,
    }
  } catch (error) {
    const aborted = controller.signal.aborted
    const appError =
      error instanceof AppError
        ? error
        : new AppError(aborted ? 'TIMEOUT' : 'LLM_UNAVAILABLE', aborted ? 'That took too long. Try again.' : undefined, {
            cause: error,
          })
    logger.error('chat_answer_failed', {
      contractId: turn.contract.id,
      code: appError.code,
      azureError: describeAzureError(error),
      cause: appError.details.cause ?? error,
    })
    await logUsage({
      userId,
      contractId: turn.contract.id,
      operation: 'chat',
      model: llm.model,
      usage,
      latencyMs: Date.now() - startedAt,
      attempts: Math.max(1, attempts),
      success: false,
      finishReason,
    })
    throw appError
  } finally {
    clearTimeout(timer)
  }
}
