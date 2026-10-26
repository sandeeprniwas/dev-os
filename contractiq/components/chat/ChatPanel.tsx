'use client'

import { ArrowDown, MessageSquare } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { useContractChat } from '@/hooks/use-contract-chat'
import type { ContractType } from '@/types/domain'
import { ChatInput } from './ChatInput'
import { ChatMessageBubble } from './ChatMessageBubble'

const SUGGESTIONS: Record<ContractType, string[]> = {
  nda: ['What happens if I breach the NDA?', 'How long does confidentiality last?', 'Can I share information with my advisors?'],
  msa: ['Is there an auto-renewal clause?', 'What is the liability cap?', 'How can either party terminate?'],
}

const STICK_THRESHOLD_PX = 80

type ChatPanelProps = { contractId: string; contractType: ContractType; onCite: (page: number) => void }

export function ChatPanel({ contractId, contractType, onCite }: ChatPanelProps) {
  const { messages, history, isStreaming, atLimit, send, retry } = useContractChat(contractId, true)
  const listRef = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(true)

  useLayoutEffect(() => {
    const list = listRef.current
    if (list && stuck) list.scrollTop = list.scrollHeight
  }, [messages, stuck])

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const onScroll = () => setStuck(list.scrollHeight - list.scrollTop - list.clientHeight < STICK_THRESHOLD_PX)
    list.addEventListener('scroll', onScroll)
    return () => list.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="flex h-full min-h-[480px] flex-col rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-body-lg text-fg">Ask about this contract</h2>
        <p className="text-body-sm text-fg-muted">Answers come only from this document and cite their pages.</p>
      </div>

      <div ref={listRef} role="log" aria-live="polite" aria-label="Conversation" className="relative flex-1 overflow-y-auto px-4 py-4">
        {history.isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="ml-auto h-10 w-2/3" />
            <Skeleton className="h-16 w-3/4" />
          </div>
        ) : history.isError ? (
          <div className="flex flex-col items-start gap-2 text-body text-fg-muted">
            We couldn&apos;t load this conversation.
            <Button size="sm" variant="secondary" onClick={() => history.refetch()}>
              Try again
            </Button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <MessageSquare className="h-8 w-8 text-fg-muted" aria-hidden="true" />
            <p className="text-body-lg text-fg">Ask anything about this contract</p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS[contractType].map((suggestion) => (
                <Button key={suggestion} variant="secondary" size="sm" disabled={isStreaming || atLimit} onClick={() => send(suggestion)}>
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((message) => (
              <ChatMessageBubble key={message.id} message={message} onCite={onCite} onRetry={retry} />
            ))}
          </div>
        )}
        {!stuck && messages.length > 0 && (
          <Button
            size="sm"
            variant="secondary"
            className="sticky bottom-2 left-full float-right"
            onClick={() => {
              listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
              setStuck(true)
            }}
          >
            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
            Jump to latest
          </Button>
        )}
      </div>

      {atLimit ? (
        <p role="status" className="border-t border-border bg-subtle px-4 py-3 text-body text-fg-muted">
          This conversation has reached its limit.
        </p>
      ) : (
        <ChatInput disabled={isStreaming} onSend={send} />
      )}
    </div>
  )
}
