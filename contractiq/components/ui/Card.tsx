import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

type CardElement = 'div' | 'section' | 'article' | 'li'

export type CardProps = HTMLAttributes<HTMLElement> & { as?: CardElement; padding?: 0 | 4 | 6 | 8 }

const PADDING_CLASS = { 0: '', 4: 'p-4', 6: 'p-6', 8: 'p-8' } as const

/** Elevated surface: white on the grey-25 page with a 1px grey-100 border; no shadow (flat depth). */
export function Card({ as: Component = 'div', padding = 6, className, ...props }: CardProps) {
  return (
    <Component
      className={cn('rounded-lg border border-border bg-surface', PADDING_CLASS[padding], className)}
      {...props}
    />
  )
}
