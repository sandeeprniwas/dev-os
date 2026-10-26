import { Slot } from '@radix-ui/react-slot'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export const buttonVariantClass: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-fg-inverse hover:bg-brand-600 active:bg-brand-700',
  secondary: 'border border-border bg-surface text-fg hover:border-border-strong hover:bg-subtle active:bg-grey-100',
  ghost: 'text-fg hover:bg-subtle active:bg-grey-100',
  danger: 'bg-danger text-fg-inverse hover:bg-danger-600 active:bg-danger-700',
}

export const buttonSizeClass: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-body font-medium',
  md: 'h-10 px-4 text-body-lg',
  lg: 'h-12 px-6 text-body-lg',
}

export const buttonBaseClass =
  'inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md transition-colors duration-micro ease-out ' +
  'disabled:pointer-events-none disabled:border disabled:border-border disabled:bg-grey-25 disabled:text-fg-disabled ' +
  'aria-disabled:pointer-events-none aria-disabled:border aria-disabled:border-border aria-disabled:bg-grey-25 aria-disabled:text-fg-disabled'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  /** Render the child element (e.g. next/link) with button styling. `loading` is ignored. */
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, asChild = false, className, children, disabled, type, ...props },
  ref,
) {
  const classes = cn(buttonBaseClass, buttonVariantClass[variant], buttonSizeClass[size], className)

  if (asChild) {
    return (
      <Slot ref={ref} className={classes} {...props}>
        {children}
      </Slot>
    )
  }

  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner size={16} />}
      {children}
    </button>
  )
})
