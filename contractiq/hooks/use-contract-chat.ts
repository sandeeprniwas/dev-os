'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ERROR_DEFINITIONS } from '@/lib/api/errors'
import { MAX_CHAT_MESSAGES } from '@/lib/constants/limits'
import { apiFetch, apiRequest, ApiClientError } from '@/lib/utils/api-fetch'
import { readSse } from '@/lib/utils/read-sse'
import type { ChatHistoryDTO, ChatMessageDTO, ChatStreamEvents } from '@/types/api'

export type ChatMessageVM = ChatMessageDTO & { status: 'sent' | 'streaming' | 'failed'; errorMessage?: string }

export const chatKey = (contractId: string) => ['chat', contractId] as const

const tempId = () => `temp-${crypto.randomUUID()}`

/** Loads persisted history and streams new answers over SSE (contract-chat spec §7.1). */
export function useContractChat(contractId: string, enabled: boolean) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const history = useQuery({
    queryKey: chatKey(contractId),
    queryFn: () => apiFetch<ChatHistoryDTO>(`/api/contracts/${contractId}/chat`),
    enabled,
    staleTime: Infinity,
  })

  const [pending, setPending] = useState<ChatMessageVM[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [limitReached, setLimitReached] = useState(false)
  const streaming = useRef(false)

  const messages = useMemo<ChatMessageVM[]>(
    () => [...(history.data?.messages ?? []).map((m) => ({ ...m, status: 'sent' as const })), ...pending],
    [history.data, pending],
  )

  const atLimit = limitReached || (history.data?.session?.messageCount ?? 0) >= MAX_CHAT_MESSAGES - 1

  const run = useCallback(
    async (text: string, retryOfMessageId?: string) => {
      if (streaming.current) return
      streaming.current = true
      setIsStreaming(true)

      const userTemp = tempId()
      const assistantTemp = tempId()
      const now = new Date().toISOString()
      setPending((current) => [
        ...current.filter((m) => m.status !== 'failed'),
        ...(retryOfMessageId ? [] : [{ id: userTemp, role: 'user' as const, content: text, citedPages: [], createdAt: now, status: 'sent' as const }]),
        { id: assistantTemp, role: 'assistant', content: '', citedPages: [], createdAt: now, status: 'streaming' },
      ])

      const patchAssistant = (patch: Partial<ChatMessageVM>) =>
        setPending((current) => current.map((m) => (m.id === assistantTemp ? { ...m, ...patch } : m)))

      let userMessageId = retryOfMessageId ?? userTemp
      try {
        const response = await apiRequest(`/api/contracts/${contractId}/chat`, {
          method: 'POST',
          body: { message: text, ...(retryOfMessageId ? { retryOfMessageId } : {}) },
        })

        let content = ''
        let finished = false
        for await (const frame of readSse<ChatStreamEvents[keyof ChatStreamEvents]>(response.body!)) {
          if (frame.event === 'meta') {
            const meta = frame.data as ChatStreamEvents['meta']
            const previous = userMessageId
            userMessageId = meta.userMessageId
            setPending((current) => current.map((m) => (m.id === previous ? { ...m, id: meta.userMessageId } : m)))
          } else if (frame.event === 'delta') {
            content += (frame.data as ChatStreamEvents['delta']).text
            patchAssistant({ content })
          } else if (frame.event === 'replace') {
            content = (frame.data as ChatStreamEvents['replace']).content
            patchAssistant({ content })
          } else if (frame.event === 'done') {
            const done = frame.data as ChatStreamEvents['done']
            finished = true
            const assistant: ChatMessageDTO = { id: done.assistantMessageId, role: 'assistant', content, citedPages: done.citedPages, createdAt: new Date().toISOString() }
            const user: ChatMessageDTO = { id: userMessageId, role: 'user', content: text, citedPages: [], createdAt: now }
            queryClient.setQueryData<ChatHistoryDTO>(chatKey(contractId), (data) => {
              const base = data ?? { session: null, messages: [] }
              const existing = base.messages.filter((m) => m.id !== userMessageId)
              return {
                session: base.session ? { ...base.session, messageCount: base.session.messageCount + (retryOfMessageId ? 1 : 2) } : base.session,
                messages: [...existing, user, assistant],
              }
            })
            setPending([])
          } else if (frame.event === 'error') {
            finished = true
            const error = frame.data as ChatStreamEvents['error']
            setPending((current) =>
              current.map((m) =>
                m.id === assistantTemp ? { ...m, content: '', status: 'failed', errorMessage: error.message, id: `failed-${userMessageId}` } : m,
              ),
            )
          }
        }
        if (!finished) {
          setPending((current) =>
            current.map((m) =>
              m.id === assistantTemp ? { ...m, content: '', status: 'failed', errorMessage: ERROR_DEFINITIONS.TIMEOUT.message, id: `failed-${userMessageId}` } : m,
            ),
          )
        }
      } catch (error) {
        const apiError = error instanceof ApiClientError ? error : null
        // 4xx before streaming: the server rejected the request, so the question was not saved.
        const rejected = apiError !== null && apiError.status >= 400 && apiError.status < 500

        if (rejected) {
          setPending((current) => current.filter((m) => m.id !== assistantTemp && m.id !== userTemp))
          if (apiError.code === 'CHAT_LIMIT_REACHED') setLimitReached(true)
          else if (apiError.code === 'NOT_FOUND') {
            toast.error('This contract no longer exists.')
            router.replace('/dashboard')
          } else toast.error(apiError.message)
        } else {
          setPending((current) =>
            current.map((m) =>
              m.id === assistantTemp
                ? { ...m, status: 'failed', errorMessage: apiError?.message ?? "I couldn't answer right now.", id: `failed-${userMessageId}` }
                : m,
            ),
          )
        }
      } finally {
        streaming.current = false
        setIsStreaming(false)
      }
    },
    [contractId, queryClient, router],
  )

  const send = useCallback((text: string) => run(text.trim()), [run])

  /** Retries a failed answer; the saved user message is reused (no duplicate). */
  const retry = useCallback(
    (failedId: string) => {
      const userId = failedId.replace(/^failed-/, '')
      const userMessage = messages.find((m) => m.id === userId)
      if (!userMessage) return
      const unsaved = userId.startsWith('temp-')
      // An unsaved question is re-sent as a new message, so drop its stale bubble first.
      setPending((current) => current.filter((m) => m.id !== failedId && !(unsaved && m.id === userId)))
      void run(userMessage.content, unsaved ? undefined : userId)
    },
    [messages, run],
  )

  return { messages, history, isStreaming, atLimit, send, retry }
}
