'use client'

import { useEffect, useMemo, useRef } from 'react'
import { cn } from '@/lib/utils/cn'
import { confidenceLevel } from '@/lib/utils/confidence'
import { useReviewStore, type TermSortMode } from '@/stores/review-store'
import type { KeyTermDTO } from '@/types/api'
import type { ContractType } from '@/types/domain'
import { KeyTermCard } from './KeyTermCard'

type KeyTermsPanelProps = {
  contractId: string
  contractType: ContractType
  terms: KeyTermDTO[]
  onFocusTerm: (term: KeyTermDTO) => void
}

const SORT_OPTIONS: { value: TermSortMode; label: string }[] = [
  { value: 'document', label: 'Document order' },
  { value: 'confidence', label: 'Lowest confidence first' },
]

export function KeyTermsPanel({ contractId, contractType, terms, onFocusTerm }: KeyTermsPanelProps) {
  const { sortMode, setSortMode, target } = useReviewStore()
  const cardRefs = useRef(new Map<string, HTMLLIElement>())

  const counts = useMemo(() => {
    const result = { high: 0, medium: 0, low: 0 }
    for (const term of terms) result[confidenceLevel(term.confidenceScore)]++
    return result
  }, [terms])

  const sorted = useMemo(
    () => (sortMode === 'confidence' ? [...terms].sort((a, b) => a.confidenceScore - b.confidenceScore) : terms),
    [terms, sortMode],
  )
  const standard = sorted.filter((term) => sortMode === 'confidence' || !term.isCustom)
  const custom = sortMode === 'confidence' ? [] : sorted.filter((term) => term.isCustom)

  useEffect(() => {
    if (!target.termId) return
    cardRefs.current.get(target.termId)?.scrollIntoView({ block: 'nearest' })
  }, [target.termId, target.nonce])

  const renderCard = (term: KeyTermDTO, index: number) => (
    <KeyTermCard
      key={term.id}
      ref={(node) => {
        if (node) cardRefs.current.set(term.id, node)
        else cardRefs.current.delete(term.id)
      }}
      term={term}
      contractId={contractId}
      contractType={contractType}
      highlighted={target.termId === term.id}
      onFocusPage={onFocusTerm}
      tourAnchor={index === 0}
    />
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body text-fg-muted">
          {terms.length} terms ·{' '}
          <span className="text-success-700">{counts.high} high</span> ·{' '}
          <span className="text-warning-900">{counts.medium} medium</span> ·{' '}
          <span className="text-danger-700">{counts.low} low</span>
        </p>
        <div role="group" aria-label="Sort terms" className="inline-flex rounded-md border border-border bg-surface p-0.5">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={sortMode === option.value}
              onClick={() => setSortMode(option.value)}
              className={cn(
                'h-7 rounded-sm px-2 text-body-sm font-medium transition-colors duration-micro',
                sortMode === option.value ? 'bg-brand-50 text-brand-700' : 'text-fg-muted hover:text-fg',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="flex flex-col gap-3" aria-label="Extracted key terms">
        {standard.map(renderCard)}
      </ul>
      {custom.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="custom-terms-heading">
          <h3 id="custom-terms-heading" className="text-body font-medium text-fg-muted">
            Custom terms
          </h3>
          <ul className="flex flex-col gap-3">{custom.map((term, i) => renderCard(term, standard.length + i))}</ul>
        </section>
      )}
    </div>
  )
}
