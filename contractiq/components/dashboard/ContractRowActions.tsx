'use client'

import { ExternalLink, MoreHorizontal, PlayCircle, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { DeleteContractDialog } from '@/components/contracts/DeleteContractDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { IconButton } from '@/components/ui/IconButton'
import type { ContractSummaryDTO } from '@/types/api'

export function ContractRowActions({ contract }: { contract: ContractSummaryDTO }) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const canProcess = contract.status === 'uploaded' || contract.status === 'error'

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton label={`More actions for ${contract.title}`} icon={<MoreHorizontal />} />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => router.push(`/contracts/${contract.id}`)}>
            <ExternalLink aria-hidden="true" />
            Open
          </DropdownMenuItem>
          {canProcess && (
            <DropdownMenuItem onSelect={() => router.push(`/contracts/${contract.id}`)}>
              <PlayCircle aria-hidden="true" />
              Process
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem tone="danger" onSelect={() => setConfirmOpen(true)}>
            <Trash2 aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteContractDialog
        contractId={contract.id}
        title={contract.title}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
      />
    </>
  )
}
