'use client'

import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils/cn'

export const DropdownMenu = DropdownPrimitive.Root
export const DropdownMenuTrigger = DropdownPrimitive.Trigger

export const DropdownMenuContent = forwardRef<HTMLDivElement, DropdownPrimitive.DropdownMenuContentProps>(
  function DropdownMenuContent({ className, sideOffset = 6, align = 'end', ...props }, ref) {
    return (
      <DropdownPrimitive.Portal>
        <DropdownPrimitive.Content
          ref={ref}
          sideOffset={sideOffset}
          align={align}
          collisionPadding={8}
          className={cn('z-50 min-w-48 rounded-lg border border-border bg-surface p-1 shadow-overlay', className)}
          {...props}
        />
      </DropdownPrimitive.Portal>
    )
  },
)

type ItemProps = DropdownPrimitive.DropdownMenuItemProps & { tone?: 'default' | 'danger' }

export const DropdownMenuItem = forwardRef<HTMLDivElement, ItemProps>(function DropdownMenuItem(
  { className, tone = 'default', ...props },
  ref,
) {
  return (
    <DropdownPrimitive.Item
      ref={ref}
      className={cn(
        'flex h-9 cursor-pointer select-none items-center gap-2 rounded-md px-3 text-body outline-none',
        'data-[disabled]:pointer-events-none data-[disabled]:text-fg-disabled data-[highlighted]:bg-subtle',
        '[&>svg]:h-4 [&>svg]:w-4',
        tone === 'danger' ? 'text-danger-700' : 'text-fg',
        className,
      )}
      {...props}
    />
  )
})

export function DropdownMenuLabel({ className, ...props }: DropdownPrimitive.DropdownMenuLabelProps) {
  return <DropdownPrimitive.Label className={cn('truncate px-3 py-2 text-body-sm text-fg-muted', className)} {...props} />
}

export function DropdownMenuSeparator() {
  return <DropdownPrimitive.Separator className="my-1 h-px bg-border" />
}
