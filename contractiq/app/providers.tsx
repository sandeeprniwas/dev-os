'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/Tooltip'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
          mutations: { retry: 0 },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {children}
        <Toaster richColors position="top-right" closeButton />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
