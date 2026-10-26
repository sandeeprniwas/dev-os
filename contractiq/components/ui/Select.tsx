'use client'

import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils/cn'
import { fieldBaseClass, fieldInvalidClass } from './Input'

export type SelectOption = { value: string; label: string }

type SelectProps = {
  id?: string
  options: SelectOption[]
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  'aria-describedby'?: string
  'aria-label'?: string
  className?: string
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  { id, options, value, onValueChange, placeholder, disabled, invalid = false, className, ...aria },
  ref,
) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        ref={ref}
        id={id}
        aria-invalid={invalid || undefined}
        className={cn(
          fieldBaseClass,
          'flex h-10 items-center justify-between gap-2 text-left data-[placeholder]:text-fg-disabled',
          invalid && fieldInvalidClass,
          className,
        )}
        {...aria}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="h-4 w-4 text-fg-muted" aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-border bg-surface shadow-overlay"
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className={cn(
                  'relative flex h-10 cursor-pointer select-none items-center rounded-md pl-8 pr-3 text-body text-fg outline-none',
                  'data-[highlighted]:bg-subtle data-[state=checked]:font-medium',
                )}
              >
                <SelectPrimitive.ItemIndicator className="absolute left-2 inline-flex">
                  <Check className="h-4 w-4 text-brand" aria-hidden="true" />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
})
