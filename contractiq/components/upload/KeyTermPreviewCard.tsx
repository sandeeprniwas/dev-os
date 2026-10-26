'use client'

import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { IconButton } from '@/components/ui/IconButton'
import { STANDARD_TERMS } from '@/lib/constants/standard-terms'
import type { AddCustomTermResult } from '@/stores/upload-store'
import type { ContractType } from '@/types/domain'
import { AddCustomTermInput } from './AddCustomTermInput'

type KeyTermPreviewCardProps = {
  contractType: ContractType | null
  customTerms: string[]
  canEdit: boolean
  onAdd: (name: string) => AddCustomTermResult
  onRemove: (name: string) => void
  progress: ReactNode
  action: ReactNode
}

export function KeyTermPreviewCard({ contractType, customTerms, canEdit, onAdd, onRemove, progress, action }: KeyTermPreviewCardProps) {
  const standard = contractType ? STANDARD_TERMS[contractType] : []
  const total = standard.length + customTerms.length

  return (
    <Card padding={6} className="flex flex-col gap-6">
      {progress}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-body-lg text-fg">ContractIQ will look for</h2>
          {contractType && <Badge tone="neutral">{total} terms</Badge>}
        </div>
        {!contractType ? (
          <p className="text-body text-fg-muted">Select a contract type to see which terms we&apos;ll extract.</p>
        ) : (
          <ul className="max-h-[360px] overflow-y-auto" aria-label="Terms to extract">
            {standard.map((term) => (
              <li key={term.key} className="flex items-center justify-between gap-2 border-b border-border py-2 last:border-0">
                <span className="text-body text-fg">{term.name}</span>
                <Badge tone="neutral">Standard</Badge>
              </li>
            ))}
            {customTerms.map((name) => (
              <li key={name} className="flex items-center justify-between gap-2 border-b border-border py-2 last:border-0">
                <span className="min-w-0 truncate text-body text-fg" title={name}>
                  {name}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <Badge tone="accent">Custom</Badge>
                  {canEdit && <IconButton label={`Remove ${name}`} icon={<X />} onClick={() => onRemove(name)} />}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {contractType && <AddCustomTermInput disabled={!canEdit} count={customTerms.length} onAdd={onAdd} />}
      {action}
    </Card>
  )
}
