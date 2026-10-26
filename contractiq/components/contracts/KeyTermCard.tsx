'use client'

import { Info } from 'lucide-react'
import { forwardRef } from 'react'
import { Badge } from '@/components/ui/Badge'
import { IconButton } from '@/components/ui/IconButton'
import { Tooltip } from '@/components/ui/Tooltip'
import { termDefinition } from '@/lib/constants/standard-terms'
import { cn } from '@/lib/utils/cn'
import { confidenceLevel } from '@/lib/utils/confidence'
import type { KeyTermDTO } from '@/types/api'
import type { ContractType } from '@/types/domain'
import { ConfidenceBadge, LowConfidenceWarning } from './ConfidenceBadge'
import { EditableTermValue } from './EditableTermValue'
import { PageReferenceButton } from './PageReferenceButton'
import { SourceSentenceDisclosure } from './SourceSentenceDisclosure'

type KeyTermCardProps = {
  term: KeyTermDTO
  contractId: string
  contractType: ContractType
  highlighted: boolean
  onFocusPage: (term: KeyTermDTO) => void
  tourAnchor?: boolean
}

export const KeyTermCard = forwardRef<HTMLLIElement, KeyTermCardProps>(function KeyTermCard(
  { term, contractId, contractType, highlighted, onFocusPage, tourAnchor },
  ref,
) {
  const definition = term.isCustom ? null : termDefinition(contractType, term.termKey)
  const low = confidenceLevel(term.confidenceScore) === 'low'

  return (
    <li
      ref={ref}
      className={cn(
        'flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 transition-colors duration-fast',
        highlighted && 'border-l-4 border-l-brand',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="flex items-center gap-1 text-body font-medium text-fg">
          {term.termName}
          {definition && (
            <Tooltip content={definition}>
              <IconButton label={`What is ${term.termName}?`} icon={<Info />} className="h-6 w-6" />
            </Tooltip>
          )}
        </h3>
        {term.isCustom && <Badge tone="accent">Custom</Badge>}
      </div>

      <EditableTermValue term={term} contractId={contractId} />
      {low && <LowConfidenceWarning />}

      <div className="flex flex-wrap items-center gap-2">
        <PageReferenceButton page={term.pageNumber} onSelect={() => onFocusPage(term)} />
        <span data-tour={tourAnchor ? 'confidence' : undefined}>
          <ConfidenceBadge score={term.confidenceScore} />
        </span>
        {term.isEdited && (
          <Tooltip
            content={
              term.originalValue ? `AI originally extracted: “${term.originalValue}”` : 'AI originally found no value'
            }
          >
            <Badge tone="neutral" tabIndex={0}>
              Edited
            </Badge>
          </Tooltip>
        )}
      </div>

      <SourceSentenceDisclosure term={term} />
    </li>
  )
})
