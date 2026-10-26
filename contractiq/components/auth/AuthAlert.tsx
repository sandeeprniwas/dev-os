import { AlertTriangle, Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

type AuthAlertProps = { tone: 'danger' | 'warning' | 'info'; children: ReactNode }

const TONE = {
  danger: 'border-danger-200 bg-danger-50 text-danger-700',
  warning: 'border-warning-200 bg-warning-50 text-warning-900',
  info: 'border-brand-200 bg-brand-50 text-brand-700',
} as const

export function AuthAlert({ tone, children }: AuthAlertProps) {
  const Icon = tone === 'info' ? Info : AlertTriangle
  return (
    <div role="alert" className={cn('flex gap-2 rounded-md border px-3 py-2 text-body', TONE[tone])}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  )
}
