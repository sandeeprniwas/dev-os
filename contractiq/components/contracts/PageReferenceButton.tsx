'use client'

import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/Button'

type PageReferenceButtonProps = { page: number | null; onSelect: () => void }

export function PageReferenceButton({ page, onSelect }: PageReferenceButtonProps) {
  if (page === null) {
    return <span className="text-body-sm text-fg-muted">No page</span>
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onSelect}
      aria-label={`Go to page ${page} in the document`}
      className="h-7 px-2 text-body-sm"
      data-tour="page"
    >
      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
      p. {page}
    </Button>
  )
}
