'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'

export default function GlobalRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(JSON.stringify({ level: 'error', message: 'route_render_failed', digest: error.digest }))
  }, [error])

  return (
    <main id="main" className="flex min-h-screen items-center justify-center bg-page px-4">
      <div role="alert" className="flex max-w-md flex-col items-center gap-6 text-center">
        <AlertTriangle className="h-10 w-10 text-danger" aria-hidden="true" />
        <div className="flex flex-col gap-2">
          <h1 className="text-h5 text-fg">Something went wrong</h1>
          <p className="text-body text-fg-muted">
            This page couldn&apos;t be loaded. Try again, or go back to your dashboard.
          </p>
          {error.digest && <p className="text-body-sm text-fg-muted">Reference: {error.digest}</p>}
        </div>
        <div className="flex gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button variant="secondary" asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
