'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MAX_CHAT_MESSAGES } from '@/lib/constants/limits'
import { apiFetch, ApiClientError } from '@/lib/utils/api-fetch'
import type { ChatAnswerDTO, ChatErrorBody, ChatHistoryDTO, ChatMessageDTO } from '@/types/api'

/** 'streaming' = waiting for the agent's reply (shows the typing indicator). */
export type ChatMessageVM = ChatMessageDTO & { status: 'sent' | 'streaming' | 'failed'; errorMessage?: string }

export const chatKey = (contractId: string) => ['chat', contractId] as const

const tempId = () => `temp-${crypto.randomUUID()}`

/** Loads persisted history and asks the Azure agent for answers via plain JSON fetch (contract-chat spec §7.1). */
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

      let userMessageId = retryOfMessageId ?? userTemp
      try {
        const answer = await apiFetch<ChatAnswerDTO>(`/api/contracts/${contractId}/chat`, {
          method: 'POST',
          body: { message: text, ...(retryOfMessageId ? { retryOfMessageId } : {}) },
        })
        if (answer.userMessageId) userMessageId = answer.userMessageId

        const assistant: ChatMessageDTO = {
          id: answer.assistantMessageId ?? tempId(),
          role: 'assistant',
          content: answer.assistantMessage,
          citedPages: answer.citedPages,
          createdAt: new Date().toISOString(),
        }
        const user: ChatMessageDTO = { id: userMessageId, role: 'user', content: text, citedPages: [], createdAt: now }
        queryClient.setQueryData<ChatHistoryDTO>(chatKey(contractId), (data) => {
          const base = data ?? { session: null, messages: [] }
          const existing = base.messages.filter((m) => m.id !== userMessageId)
          return {
            session: base.session
              ? { ...base.session, messageCount: base.session.messageCount + (retryOfMessageId ? 1 : 2) }
              : { id: answer.sessionId, messageCount: retryOfMessageId ? 1 : 2 },
            messages: [...existing, user, assistant],
          }
        })
        setPending([])
      } catch (error) {
        const apiError = error instanceof ApiClientError ? error : null
        // The server returns the saved question's id when the AI call (not the request) failed.
        const savedUserId = (apiError?.body as Partial<ChatErrorBody> | undefined)?.userMessageId ?? null
        // 4xx without a saved question: the server rejected the request before calling the AI.
        const rejected = apiError !== null && apiError.status >= 400 && apiError.status < 500 && !savedUserId

        if (rejected) {
          setPending((current) => current.filter((m) => m.id !== assistantTemp && m.id !== userTemp))
          if (apiError.code === 'CHAT_LIMIT_REACHED') setLimitReached(true)
          else if (apiError.code === 'NOT_FOUND') {
            toast.error('This contract no longer exists.')
            router.replace('/dashboard')
          } else toast.error(apiError.message)
        } else {
          if (savedUserId) {
            const previous = userMessageId
            userMessageId = savedUserId
            setPending((current) => current.map((m) => (m.id === previous ? { ...m, id: savedUserId } : m)))
          }
          const message = apiError?.message ?? "I couldn't answer right now."
          setPending((current) =>
            current.map((m) =>
              m.id === assistantTemp
                ? {
                    ...m,
                    status: 'failed',
                    errorMessage: apiError?.azureError ? `${message} (Azure: ${apiError.azureError})` : message,
                    id: `failed-${userMessageId}`,
                  }
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
