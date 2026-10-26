import type { ReactNode } from 'react'
import { FieldError } from '@/components/ui/FieldError'
import { Label } from '@/components/ui/Label'

type FormFieldProps = {
  id: string
  label: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
}

/** Label + control + hint + error, wired for aria-describedby by the caller via fieldDescribedBy(). */
export function FormField({ id, label, error, hint, required, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-body-sm text-fg-muted">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  )
}

export function fieldDescribedBy(id: string, { error, hint }: { error?: string; hint?: string }): string | undefined {
  if (error) return `${id}-error`
  if (hint) return `${id}-hint`
  return undefined
}
