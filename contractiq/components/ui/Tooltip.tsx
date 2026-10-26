'use client'

import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <TooltipPrimitive.Provider delayDuration={300}>{children}</TooltipPrimitive.Provider>
}

type TooltipProps = {
  content: ReactNode
  /** Must be a single focusable element (opens on hover and keyboard focus). */
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

export function Tooltip({ content, children, side = 'top', open, onOpenChange, className }: TooltipProps) {
  return (
    <TooltipPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className={cn('z-50 max-w-72 rounded-md bg-grey-900 px-2 py-1 text-body-sm text-fg-inverse', className)}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-grey-900" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
