import { FileQuestion } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export default function ContractNotFound() {
  return (
    <Card padding={8} className="mx-auto flex max-w-lg flex-col items-center gap-6 text-center">
      <FileQuestion className="h-10 w-10 text-fg-muted" aria-hidden="true" />
      <div className="flex flex-col gap-2">
        <h1 className="text-h5 text-fg">We couldn&apos;t find that contract</h1>
        <p className="text-body text-fg-muted">It may have been deleted, or the link is incorrect.</p>
      </div>
      <Button asChild>
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </Card>
  )
}
