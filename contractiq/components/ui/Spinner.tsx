import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type SpinnerProps = {
  size?: 16 | 20 | 24
  /** Accessible label; omit when the spinner sits inside a control that already announces state. */
  label?: string
  className?: string
}

const SIZE_CLASS = { 16: 'h-4 w-4', 20: 'h-5 w-5', 24: 'h-6 w-6' } as const

export function Spinner({ size = 16, label, className }: SpinnerProps) {
  return (
    <span role={label ? 'status' : undefined} className="inline-flex items-center">
      <Loader2 className={cn('animate-spin', SIZE_CLASS[size], className)} aria-hidden="true" />
      {label && <span className="sr-only">{label}</span>}
    </span>
  )
}
