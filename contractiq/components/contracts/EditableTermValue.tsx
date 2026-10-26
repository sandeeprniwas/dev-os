'use client'

import { Pencil } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { FieldError } from '@/components/ui/FieldError'
import { Textarea } from '@/components/ui/Textarea'
import { useUpdateKeyTerm } from '@/hooks/use-update-key-term'
import { cn } from '@/lib/utils/cn'
import { editKeyTermSchema } from '@/lib/validation/key-terms'
import type { KeyTermDTO } from '@/types/api'

const COUNTER_FROM = 800

export function EditableTermValue({ term, contractId }: { term: KeyTermDTO; contractId: string }) {
  const id = useId()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(term.value ?? '')
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const displayRef = useRef<HTMLButtonElement>(null)
  const update = useUpdateKeyTerm(contractId)

  useEffect(() => {
    if (!editing) setDraft(term.value ?? '')
  }, [term.value, editing])

  function close() {
    setEditing(false)
    setError(null)
    requestAnimationFrame(() => displayRef.current?.focus())
  }

  function save() {
    const parsed = editKeyTermSchema.safeParse({ value: draft })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a value')
      return
    }
    if (parsed.data.value !== term.value) update.mutate({ id: term.id, value: parsed.data.value })
    close()
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      save()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setDraft(term.value ?? '')
      close()
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={id} className="sr-only">
          Value for {term.termName}
        </label>
        <Textarea
          id={id}
          autoFocus
          autoGrow
          maxRows={8}
          maxLength={1000}
          value={draft}
          invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => {
            setDraft(event.target.value)
            if (error) setError(null)
          }}
          onKeyDown={onKeyDown}
          className="text-body-lg"
        />
        <div className="flex items-center justify-between gap-2">
          <FieldError id={`${id}-error`}>{error}</FieldError>
          {draft.length > COUNTER_FROM && <span className="ml-auto text-body-sm text-fg-muted">{draft.length}/1000</span>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={save}>
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(term.value ?? '')
              close()
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  const long = (term.value?.length ?? 0) > 180
  return (
    <div className="flex flex-col gap-1">
      <button
        ref={displayRef}
        type="button"
        aria-label={`Edit value for ${term.termName}`}
        onClick={() => setEditing(true)}
        className="group flex w-full items-start gap-2 rounded-sm text-left hover:bg-subtle"
      >
        <span
          className={cn(
            'min-w-0 flex-1 whitespace-pre-wrap break-words text-body-lg',
            term.value ? 'text-fg' : 'italic text-fg-muted',
            long && !expanded && 'line-clamp-4',
          )}
        >
          {term.value ?? 'Not found in document — click to add'}
        </span>
        <Pencil
          className="mt-1 h-3.5 w-3.5 shrink-0 text-fg-muted opacity-0 transition-opacity duration-micro group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden="true"
        />
      </button>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="self-start text-body-sm font-medium text-brand hover:text-brand-700"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}
