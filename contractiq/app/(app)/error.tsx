'use client'

import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export default function AppRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(JSON.stringify({ level: 'error', message: 'app_route_render_failed', digest: error.digest }))
  }, [error])

  return (
    <Card padding={8} className="mx-auto flex max-w-lg flex-col items-center gap-6 text-center" role="alert">
      <AlertTriangle className="h-10 w-10 text-danger" aria-hidden="true" />
      <div className="flex flex-col gap-2">
        <h1 className="text-h5 text-fg">This page couldn&apos;t be loaded</h1>
        <p className="text-body text-fg-muted">Something went wrong on our side. Try again in a moment.</p>
        {error.digest && <p className="text-body-sm text-fg-muted">Reference: {error.digest}</p>}
      </div>
      <div className="flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="secondary" asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </Card>
  )
}
