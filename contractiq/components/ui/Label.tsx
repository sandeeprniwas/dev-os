import type { LabelHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }

export function Label({ required = false, className, children, ...props }: LabelProps) {
  return (
    <label className={cn('text-body font-medium text-fg', className)} {...props}>
      {children}
      {required && (
        <span className="ml-1 text-danger" aria-hidden="true">
          *
        </span>
      )}
    </label>
  )
}
