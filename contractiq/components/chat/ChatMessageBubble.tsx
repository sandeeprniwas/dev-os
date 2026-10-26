'use client'

import { Fragment } from 'react'
import { Button } from '@/components/ui/Button'
import type { ChatMessageVM } from '@/hooks/use-contract-chat'
import { isNotFoundAnswer, splitCitations } from '@/lib/llm/citations'
import { cn } from '@/lib/utils/cn'
import { formatDateTime } from '@/lib/utils/format'
import { PageCitationChip } from './PageCitationChip'

type ChatMessageBubbleProps = {
  message: ChatMessageVM
  onCite: (page: number) => void
  onRetry: (id: string) => void
}

function TypingIndicator() {
  return (
    <span className="inline-flex gap-1 py-1" aria-label="Assistant is typing" role="status">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-2 w-2 animate-pulse rounded-full bg-grey-300" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </span>
  )
}

export function ChatMessageBubble({ message, onCite, onRetry }: ChatMessageBubbleProps) {
  const isUser = message.role === 'user'

  if (message.status === 'failed') {
    return (
      <div className="flex justify-start">
        <div className="flex max-w-[80%] flex-col gap-2 rounded-xl rounded-bl-sm border border-danger-200 bg-danger-50 px-4 py-3 text-body text-danger-700">
          <p>{message.errorMessage ?? "I couldn't answer right now."}</p>
          <Button size="sm" variant="secondary" className="self-start" onClick={() => onRetry(message.id)}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const notFound = !isUser && isNotFoundAnswer(message.content)
  const showNoCitation = !isUser && message.status === 'sent' && !notFound && message.citedPages.length === 0

  return (
    <div className={cn('group flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[80%] whitespace-pre-wrap break-words rounded-xl px-4 py-3 text-body',
          isUser ? 'rounded-br-sm bg-brand text-fg-inverse' : 'rounded-bl-sm bg-subtle text-fg',
        )}
        aria-busy={message.status === 'streaming'}
      >
        <span className="sr-only">{isUser ? 'You said: ' : 'ContractIQ: '}</span>
        {message.status === 'streaming' && !message.content ? (
          <TypingIndicator />
        ) : isUser ? (
          message.content
        ) : (
          splitCitations(message.content).map((part, index) =>
            part.type === 'text' ? (
              <Fragment key={index}>{part.value}</Fragment>
            ) : (
              <PageCitationChip key={index} page={part.page} onSelect={onCite} />
            ),
          )
        )}
      </div>
      {!isUser && message.status === 'sent' && message.citedPages.length > 0 && (
        <p className="flex flex-wrap items-center gap-1 text-body-sm text-fg-muted">
          Source:
          {message.citedPages.map((page) => (
            <PageCitationChip key={page} page={page} onSelect={onCite} />
          ))}
        </p>
      )}
      {showNoCitation && <p className="text-body-sm text-fg-muted">No page citation — verify in the document</p>}
      {message.status === 'sent' && !message.id.startsWith('temp-') && (
        <time
          dateTime={message.createdAt}
          className="text-body-sm text-fg-muted opacity-0 transition-opacity duration-fast group-focus-within:opacity-100 group-hover:opacity-100"
        >
          {formatDateTime(message.createdAt)}
        </time>
      )}
    </div>
  )
}
