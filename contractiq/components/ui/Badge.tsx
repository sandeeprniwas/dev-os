import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent'

/** Design-system status badge: 50 background, 200 border, 700 text (900 for warning, for AA contrast). */
export const badgeToneClass: Record<BadgeTone, string> = {
  neutral: 'border-grey-200 bg-grey-50 text-grey-700',
  info: 'border-brand-200 bg-brand-50 text-brand-700',
  success: 'border-success-200 bg-success-50 text-success-700',
  warning: 'border-warning-200 bg-warning-50 text-warning-900',
  danger: 'border-danger-200 bg-danger-50 text-danger-700',
  accent: 'border-accent-200 bg-accent-50 text-accent-700',
}

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; icon?: ReactNode }

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { tone = 'neutral', icon, className, children, ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-sm border px-2 py-0.5 text-body-sm font-medium',
        badgeToneClass[tone],
        className,
      )}
      {...props}
    >
      {icon && (
        <span aria-hidden="true" className="inline-flex [&>svg]:h-3 [&>svg]:w-3">
          {icon}
        </span>
      )}
      {children}
    </span>
  )
})
