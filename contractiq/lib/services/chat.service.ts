import 'server-only'
import { AppError } from '@/lib/api/errors'
import { LLM_TIMEOUT_MS, MAX_CHAT_MESSAGES } from '@/lib/constants/limits'
import {
  getChatSession,
  getLatestChatMessage,
  getOrCreateChatSession,
  insertChatMessage,
  listChatMessages,
} from '@/lib/db/chat.repo'
import { logUsage } from '@/lib/db/llm-usage.repo'
import { toChatMessageDTO } from '@/lib/db/mappers'
import type { DbClient } from '@/lib/db/types'
import { ensurePrefix, extractCitedPages, isNotFoundAnswer } from '@/lib/llm/citations'
import { classifyQuery } from '@/lib/llm/classify-query'
import type { TokenUsage } from '@/lib/llm/cost'
import type { ChatStreamChunk, LlmGateway } from '@/lib/llm/gateway'
import { buildChatMessages } from '@/lib/llm/prompts/chat'
import { withRetry } from '@/lib/llm/with-retry'
import { verifyContractOwnership, verifySessionOwnership } from '@/lib/security/chatSecurity'
import { detectPromptInjection, guardModelOutput, sanitizeForLLM } from '@/lib/security/promptInjectionGuard'
import { assertMessageLength, getMaxChatHistory } from '@/lib/security/tokenLimiter'
import { requireAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/utils/logger'
import { chatPostSchema } from '@/lib/validation/chat'
import type { ChatHistoryDTO, ChatStreamEvents } from '@/types/api'
import type { ChatMessageRow, ContractRow } from '@/types/domain'

const CHAT_MAX_TOKENS = 1000

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

type Send = <E extends keyof ChatStreamEvents>(event: E, data: ChatStreamEvents[E]) => void

/** Streams the grounded answer and persists it (contract-chat spec §6.2). Never throws. */
export async function streamChatAnswer(args: {
  db: DbClient
  llm: LlmGateway
  userId: string
  userHash: string
  turn: PreparedChatTurn
  send: Send
  deadline: number
}): Promise<void> {
  const { db, llm, userId, userHash, turn, send, deadline } = args
  const startedAt = Date.now()
  let usage: TokenUsage | null = null
  let finishReason: string | null = null
  let attempts = 0

  send('meta', { userMessageId: turn.userMessage.id, sessionId: turn.sessionId })

  const { messages, droppedHistory } = buildChatMessages({
    title: turn.contract.title,
    contractType: turn.contract.contract_type,
    pageCount: turn.contract.page_count,
    contractText: turn.contract.contract_text,
    history: turn.history,
    message: turn.userMessage.content,
    queryClass: classifyQuery(turn.userMessage.content),
  })
  if (droppedHistory > 0) logger.info('chat_history_truncated', { contractId: turn.contract.id, droppedHistory })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Math.max(1000, Math.min(LLM_TIMEOUT_MS, deadline - Date.now())))
  let full = ''

  try {
    // Retry only failures that happen before the first token reaches the client.
    const { result: stream } = await withRetry(
      async () => {
        attempts++
        const iterator = llm
          .streamChat({ messages, temperature: 0.4, maxTokens: CHAT_MAX_TOKENS, user: userHash, signal: controller.signal })
          [Symbol.asyncIterator]()
        const first = await iterator.next()
        return { iterator, first }
      },
      { deadline },
    )

    let refusal: string | null = null
    const handle = (chunk: ChatStreamChunk) => {
      if (chunk.type === 'delta') {
        full += chunk.text
        send('delta', { text: chunk.text })
      } else {
        finishReason = chunk.finishReason
        refusal = chunk.refusal
        usage = chunk.usage
      }
    }
    if (!stream.first.done) handle(stream.first.value)
    for (let next = await stream.iterator.next(); !next.done; next = await stream.iterator.next()) {
      handle(next.value)
    }

    if (refusal || finishReason === 'content_filter') throw new AppError('LLM_REFUSED')
    if (!full.trim()) throw new AppError('LLM_UNAVAILABLE')

    const guarded = guardModelOutput(full)
    if (!guarded.safe) logger.warn('chat_output_blocked', { contractId: turn.contract.id })
    const content = guarded.safe ? ensurePrefix(full) : guarded.text
    if (content !== full) send('replace', { content })
    const citedPages = isNotFoundAnswer(content) ? [] : extractCitedPages(content, turn.contract.page_count)
    const latencyMs = Date.now() - startedAt

    // Assistant messages are server-authored only (clients may insert role='user' rows exclusively).
    const assistant = await insertChatMessage(requireAdminClient(), {
      session_id: turn.sessionId,
      user_id: userId,
      role: 'assistant',
      content: content.slice(0, 8000),
      cited_pages: citedPages,
      latency_ms: latencyMs,
    })

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
    send('done', { assistantMessageId: assistant.id, citedPages, latencyMs })
  } catch (error) {
    const aborted = controller.signal.aborted
    const appError =
      error instanceof AppError
        ? error
        : new AppError(aborted ? 'TIMEOUT' : 'LLM_UNAVAILABLE', aborted ? "That took too long. Try again." : undefined, {
            cause: error,
          })
    logger.error('chat_answer_failed', { contractId: turn.contract.id, code: appError.code, cause: appError.details.cause ?? error })
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
    send('error', { code: appError.code, message: appError.message })
  } finally {
    clearTimeout(timer)
  }
}
