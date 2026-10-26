'use client'

import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import type { ReactNode } from 'react'
import { Button, type ButtonVariant } from './Button'
import { modalContentClass, overlayClass } from './Dialog'

type AlertDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  cancelLabel?: string
  confirmVariant?: ButtonVariant
  loading?: boolean
  onConfirm: () => void
}

/** Confirmation for destructive actions. Cancel receives initial focus. */
export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
  loading = false,
  onConfirm,
}: AlertDialogProps) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className={overlayClass} />
        <AlertDialogPrimitive.Content className={modalContentClass}>
          <AlertDialogPrimitive.Title className="text-h5 text-fg">{title}</AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="text-body text-fg-muted">
            {description}
          </AlertDialogPrimitive.Description>
          <div className="flex justify-end gap-3">
            <AlertDialogPrimitive.Cancel asChild>
              <Button variant="secondary" disabled={loading}>
                {cancelLabel}
              </Button>
            </AlertDialogPrimitive.Cancel>
            {/* Not wrapped in AlertDialog.Action: the dialog stays open until the async action settles. */}
            <Button variant={confirmVariant} loading={loading} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}
