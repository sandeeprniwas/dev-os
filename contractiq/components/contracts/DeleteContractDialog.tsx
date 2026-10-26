'use client'

import { AlertDialog } from '@/components/ui/AlertDialog'
import { useDeleteContract } from '@/hooks/use-delete-contract'

type DeleteContractDialogProps = {
  contractId: string
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

export function DeleteContractDialog({ contractId, title, open, onOpenChange, onDeleted }: DeleteContractDialogProps) {
  const deletion = useDeleteContract({
    onDeleted: () => {
      onOpenChange(false)
      onDeleted?.()
    },
  })

  return (
    <AlertDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete "${title}"?`}
      description="This permanently deletes the contract, its extracted terms and its chat history. This can't be undone."
      confirmLabel="Delete"
      loading={deletion.isPending}
      onConfirm={() => deletion.mutate(contractId)}
    />
  )
}
