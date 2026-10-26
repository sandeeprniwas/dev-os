import { AlertTriangle, CheckCircle2, Circle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils/cn'
import type { ProcessError, ProcessStep } from '@/hooks/use-process-contract'

type StepState = 'done' | 'active' | 'pending'

type ProcessingProgressProps = {
  uploadState: StepState
  processStep: ProcessStep
  error: ProcessError | null
  onRetry?: () => void
  retrying?: boolean
}

function stepStates(uploadState: StepState, processStep: ProcessStep): [StepState, StepState, StepState] {
  switch (processStep) {
    case 'saving':
    case 'analysing':
    case 'waiting':
      return ['done', 'active', 'pending']
    case 'compiling':
      return ['done', 'done', 'active']
    case 'done':
      return ['done', 'done', 'done']
    default:
      return [uploadState, 'pending', 'pending']
  }
}

const LABELS = ['Extracting text', 'Analysing with AI', 'Compiling results']

export function ProcessingProgress({ uploadState, processStep, error, onRetry, retrying }: ProcessingProgressProps) {
  const states = stepStates(uploadState, processStep)
  const running = ['saving', 'analysing', 'compiling', 'waiting'].includes(processStep)

  return (
    <div className="flex flex-col gap-4">
      <ol aria-live="polite" className="flex flex-col gap-3">
        {LABELS.map((label, index) => {
          const state = states[index]
          return (
            <li key={label} aria-current={state === 'active' ? 'step' : undefined} className="flex items-center gap-3">
              {state === 'done' && <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />}
              {state === 'active' && <Spinner size={20} className="text-brand" />}
              {state === 'pending' && <Circle className="h-5 w-5 text-grey-300" aria-hidden="true" />}
              <span className={cn('text-body', state === 'pending' ? 'text-fg-muted' : 'font-medium text-fg')}>
                {label}
                <span className="sr-only">
                  {state === 'done' ? ' — complete' : state === 'active' ? ' — in progress' : ' — not started'}
                </span>
              </span>
            </li>
          )
        })}
      </ol>
      {running && (
        <p className="text-body-sm text-fg-muted">
          {processStep === 'waiting'
            ? 'This contract is already being processed. Waiting for it to finish…'
            : 'This usually takes 10–20 seconds.'}
        </p>
      )}
      {processStep === 'error' && error && (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-danger-200 bg-danger-50 p-4">
          <p className="flex items-start gap-2 text-body text-danger-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error.message}
          </p>
          {onRetry && (
            <Button onClick={onRetry} loading={retrying} className="self-start">
              Try again
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
