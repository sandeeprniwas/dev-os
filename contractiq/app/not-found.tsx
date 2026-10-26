import Link from 'next/link'
import { FileQuestion } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <FileQuestion className="h-10 w-10 text-fg-muted" aria-hidden="true" />
        <div className="flex flex-col gap-2">
          <h1 className="text-h5 text-fg">We couldn&apos;t find that page</h1>
          <p className="text-body text-fg-muted">
            The page or contract you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </main>
  )
}
