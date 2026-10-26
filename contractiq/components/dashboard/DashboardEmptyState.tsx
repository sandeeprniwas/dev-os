import { FileText, Upload } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export function DashboardEmptyState() {
  return (
    <Card padding={8} className="flex flex-col items-center gap-6 py-16 text-center">
      <FileText className="h-10 w-10 text-fg-muted" aria-hidden="true" />
      <div className="flex flex-col gap-2">
        <h2 className="text-h5 text-fg">No contracts reviewed yet — upload your first contract to begin</h2>
        <p className="text-body text-fg-muted">
          ContractIQ extracts the key terms from NDAs and MSAs, with page references and confidence scores.
        </p>
      </div>
      <Button size="lg" asChild>
        <Link href="/contracts/new">
          <Upload className="h-4 w-4" aria-hidden="true" />
          Review a contract
        </Link>
      </Button>
    </Card>
  )
}
