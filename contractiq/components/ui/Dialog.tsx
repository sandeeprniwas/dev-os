'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { IconButton } from './IconButton'

export const overlayClass = 'fixed inset-0 z-40 bg-grey-900/40'
export const modalContentClass =
  'fixed left-1/2 top-1/2 z-50 flex w-[calc(100vw-32px)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 ' +
  'rounded-xl border border-border bg-surface p-6 focus:outline-none'

type DialogProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: ReactNode
  title: string
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  className?: string
}

export function Dialog({ open, onOpenChange, trigger, title, description, children, footer, className }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlayClass} />
        <DialogPrimitive.Content className={cn(modalContentClass, className)}>
          <div className="flex items-start justify-between gap-4">
            <DialogPrimitive.Title className="text-h5 text-fg">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <IconButton label="Close" icon={<X />} />
            </DialogPrimitive.Close>
          </div>
          {description ? (
            <DialogPrimitive.Description className="text-body text-fg-muted">{description}</DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          )}
          {children}
          {footer && <div className="flex justify-end gap-3">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
