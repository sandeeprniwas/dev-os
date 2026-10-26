'use client'

import * as TabsPrimitive from '@radix-ui/react-tabs'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils/cn'

export const Tabs = TabsPrimitive.Root

export const TabsList = forwardRef<HTMLDivElement, TabsPrimitive.TabsListProps>(function TabsList(
  { className, ...props },
  ref,
) {
  return <TabsPrimitive.List ref={ref} className={cn('flex border-b border-border', className)} {...props} />
})

export const TabsTrigger = forwardRef<HTMLButtonElement, TabsPrimitive.TabsTriggerProps>(function TabsTrigger(
  { className, ...props },
  ref,
) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        '-mb-px inline-flex h-10 items-center gap-2 border-b-2 border-transparent px-4 text-body-lg text-fg-muted',
        'transition-colors duration-micro ease-out hover:text-fg',
        'data-[state=active]:border-brand data-[state=active]:text-fg',
        className,
      )}
      {...props}
    />
  )
})

export const TabsContent = forwardRef<HTMLDivElement, TabsPrimitive.TabsContentProps>(function TabsContent(
  { className, ...props },
  ref,
) {
  return <TabsPrimitive.Content ref={ref} className={cn('focus-visible:outline-none', className)} {...props} />
})
