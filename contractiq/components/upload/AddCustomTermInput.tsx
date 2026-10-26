'use client'

import { Plus } from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { FieldError } from '@/components/ui/FieldError'
import { Input } from '@/components/ui/Input'
import { MAX_CUSTOM_TERMS } from '@/lib/constants/limits'
import { CUSTOM_TERM_ISSUE_MESSAGES, customTermNameSchema } from '@/lib/validation/custom-terms'
import type { AddCustomTermResult } from '@/stores/upload-store'

type AddCustomTermInputProps = {
  disabled: boolean
  count: number
  onAdd: (name: string) => AddCustomTermResult
}

export function AddCustomTermInput({ disabled, count, onAdd }: AddCustomTermInputProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const atLimit = count >= MAX_CUSTOM_TERMS

  function submit() {
    const parsed = customTermNameSchema.safeParse(value)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a term name')
      return
    }
    const result = onAdd(parsed.data)
    if (result === 'added') {
      setValue('')
      setError(null)
      if (count + 1 >= MAX_CUSTOM_TERMS) setOpen(false)
    } else if (result === 'limit') {
      setError(`Up to ${MAX_CUSTOM_TERMS} custom terms`)
    } else {
      setError(CUSTOM_TERM_ISSUE_MESSAGES[result])
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      submit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      setValue('')
      setError(null)
    }
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" className="self-start" disabled={disabled || atLimit} onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Key Term
        </Button>
        {atLimit && <p className="text-body-sm text-fg-muted">Up to {MAX_CUSTOM_TERMS} custom terms</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-body font-medium text-fg">
        Custom term
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          autoFocus
          maxLength={80}
          value={value}
          placeholder="e.g. Non-compete radius"
          invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => {
            setValue(event.target.value)
            if (error) setError(null)
          }}
          onKeyDown={onKeyDown}
        />
        <Button size="md" onClick={submit}>
          Add
        </Button>
        <Button
          size="md"
          variant="ghost"
          onClick={() => {
            setOpen(false)
            setValue('')
            setError(null)
          }}
        >
          Cancel
        </Button>
      </div>
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  )
}
