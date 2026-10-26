'use client'

import { CheckCircle2, ThumbsDown, ThumbsUp } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Textarea } from '@/components/ui/Textarea'
import { useSubmitFeedback } from '@/hooks/use-feedback'
import { cn } from '@/lib/utils/cn'
import type { FeedbackDTO } from '@/types/api'
import type { FeedbackRating } from '@/types/domain'

const MAX_COMMENT = 1000
const COUNTER_FROM = 800

export function FeedbackWidget({ contractId, initial }: { contractId: string; initial: FeedbackDTO | null }) {
  const id = useId()
  const submit = useSubmitFeedback(contractId)
  const [editing, setEditing] = useState(!initial)
  const [rating, setRating] = useState<FeedbackRating | null>(initial?.rating ?? null)
  const [comment, setComment] = useState(initial?.comment ?? '')

  if (!editing) {
    return (
      <Card padding={4} className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-body text-fg">
          <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
          Thanks for the feedback
          <span className="text-fg-muted">({rating === 'up' ? 'results were accurate' : 'results were not accurate'})</span>
        </p>
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          Change
        </Button>
      </Card>
    )
  }

  const option = (value: FeedbackRating, label: string, Icon: typeof ThumbsUp) => (
    <button
      type="button"
      aria-pressed={rating === value}
      aria-label={label}
      onClick={() => setRating(value)}
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center rounded-md border transition-colors duration-micro',
        rating === value ? 'border-brand bg-brand-50 text-brand-700' : 'border-border bg-surface text-fg-muted hover:bg-subtle hover:text-fg',
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  )

  return (
    <Card padding={4} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body font-medium text-fg">Were these results accurate?</p>
        <div className="flex gap-2">
          {option('up', 'Yes, results were accurate', ThumbsUp)}
          {option('down', 'No, results were not accurate', ThumbsDown)}
        </div>
      </div>
      {rating && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            submit.mutate({ rating, comment }, { onSuccess: () => setEditing(false) })
          }}
        >
          <label htmlFor={id} className="sr-only">
            Feedback comment (optional)
          </label>
          <Textarea
            id={id}
            autoGrow
            maxRows={6}
            rows={2}
            maxLength={MAX_COMMENT}
            value={comment}
            placeholder="What could be better? (optional)"
            onChange={(event) => setComment(event.target.value)}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-body-sm text-fg-muted">
              {comment.length > COUNTER_FROM ? `${comment.length}/${MAX_COMMENT}` : ''}
            </span>
            <Button type="submit" size="sm" loading={submit.isPending}>
              Submit feedback
            </Button>
          </div>
        </form>
      )}
    </Card>
  )
}
