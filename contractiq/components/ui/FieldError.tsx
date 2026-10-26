import { cn } from '@/lib/utils/cn'

type FieldErrorProps = { id: string; children?: React.ReactNode; className?: string }

/** Validation message; link it to its field with aria-describedby={id}. Renders nothing when empty. */
export function FieldError({ id, children, className }: FieldErrorProps) {
  if (!children) return null
  return (
    <p id={id} role="alert" className={cn('text-body-sm text-danger-700', className)}>
      {children}
    </p>
  )
}
