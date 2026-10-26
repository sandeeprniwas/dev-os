import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { buttonBaseClass, buttonVariantClass, type ButtonVariant } from './Button'

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> & {
  /** Required accessible name (becomes aria-label). */
  label: string
  icon: ReactNode
  variant?: ButtonVariant
  size?: 'sm' | 'md'
}

const SIZE_CLASS = { sm: 'h-8 w-8', md: 'h-10 w-10' } as const

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant = 'ghost', size = 'sm', className, type, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      aria-label={label}
      className={cn(buttonBaseClass, buttonVariantClass[variant], SIZE_CLASS[size], 'p-0', className)}
      {...props}
    >
      <span aria-hidden="true" className="inline-flex [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </span>
    </button>
  )
})
