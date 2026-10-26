import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

export const fieldBaseClass =
  'w-full rounded-md border border-border bg-surface px-3 text-body text-fg placeholder:text-fg-disabled ' +
  'transition-colors duration-micro ease-out focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-brand-500/20 ' +
  'disabled:cursor-not-allowed disabled:bg-grey-25 disabled:text-fg-disabled'

export const fieldInvalidClass = 'border-danger bg-danger-50 focus:border-danger focus:ring-danger-500/20'

export type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid = false, className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(fieldBaseClass, 'h-10', invalid && fieldInvalidClass, className)}
      {...props}
    />
  )
})
