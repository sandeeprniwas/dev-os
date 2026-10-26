'use client'

import { SendHorizontal } from 'lucide-react'
import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { IconButton } from '@/components/ui/IconButton'
import { Textarea } from '@/components/ui/Textarea'
import { MAX_CHAT_INPUT_CHARS } from '@/lib/constants/limits'

const COUNTER_FROM = 1800

export function ChatInput({ disabled, onSend }: { disabled: boolean; onSend: (text: string) => void }) {
  const [value, setValue] = useState('')
  const canSend = !disabled && value.trim().length > 0

  function submit(event?: FormEvent) {
    event?.preventDefault()
    if (!canSend) return
    onSend(value.trim())
    setValue('')
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-1 border-t border-border bg-surface p-3">
      <div className="flex items-end gap-2">
        <label htmlFor="chat-input" className="sr-only">
          Your question
        </label>
        <Textarea
          id="chat-input"
          autoGrow
          maxRows={6}
          maxLength={MAX_CHAT_INPUT_CHARS}
          value={value}
          disabled={disabled}
          placeholder="Ask a question about this contract…"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <IconButton type="submit" label="Send message" icon={<SendHorizontal />} variant="primary" size="md" disabled={!canSend} />
      </div>
      {value.length > COUNTER_FROM && (
        <p className="text-right text-body-sm text-fg-muted">
          {value.length}/{MAX_CHAT_INPUT_CHARS}
        </p>
      )}
    </form>
  )
}
