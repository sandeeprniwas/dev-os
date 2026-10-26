'use client'

import * as PopoverPrimitive from '@radix-ui/react-popover'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverAnchor = PopoverPrimitive.Anchor
export const PopoverClose = PopoverPrimitive.Close

type PopoverContentProps = PopoverPrimitive.PopoverContentProps & { children: ReactNode }

export function PopoverContent({ className, sideOffset = 8, children, ...props }: PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        sideOffset={sideOffset}
        collisionPadding={16}
        className={cn('z-50 max-w-80 rounded-lg border border-border bg-surface p-4 shadow-overlay focus:outline-none', className)}
        {...props}
      >
        {children}
        <PopoverPrimitive.Arrow className="fill-surface" />
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  )
}
