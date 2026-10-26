'use client'

import { ArrowLeft, CheckCircle2, Download, MoreHorizontal, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { IconButton } from '@/components/ui/IconButton'
import { Tooltip } from '@/components/ui/Tooltip'
import { useMarkReviewComplete } from '@/hooks/use-feedback'
import type { ContractDTO } from '@/types/api'
import { DeleteContractDialog } from './DeleteContractDialog'
import { ContractTypeBadge, StatusBadge } from './StatusBadges'

export function ResultsHeader({ contract }: { contract: ContractDTO }) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const markComplete = useMarkReviewComplete(contract.id)
  const completed = Boolean(contract.reviewCompletedAt)

  return (
    <div className="flex flex-col gap-3">
      <Link href="/dashboard" className="inline-flex items-center gap-1 self-start rounded-sm text-body text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Dashboard
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Tooltip content={contract.title}>
            <h1 tabIndex={0} className="min-w-0 truncate rounded-sm text-h5 text-fg">
              {contract.title}
            </h1>
          </Tooltip>
          <ContractTypeBadge type={contract.contractType} />
          <StatusBadge status={contract.status} />
        </div>
        <div className="flex items-center gap-2">
          {contract.status === 'completed' && (
            <Button
              variant="secondary"
              disabled={completed}
              loading={markComplete.isPending}
              onClick={() => markComplete.mutate()}
            >
              {completed && <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />}
              {completed ? 'Review completed' : 'Mark review complete'}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label="More contract actions" icon={<MoreHorizontal />} size="md" variant="secondary" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {contract.signedUrl && (
                <DropdownMenuItem asChild>
                  <a href={contract.signedUrl} download={`${contract.title}.pdf`}>
                    <Download aria-hidden="true" />
                    Download PDF
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem tone="danger" onSelect={() => setDeleteOpen(true)}>
                <Trash2 aria-hidden="true" />
                Delete contract
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <DeleteContractDialog
        contractId={contract.id}
        title={contract.title}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => router.replace('/dashboard')}
      />
    </div>
  )
}
