'use client'

import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import { cn } from '@/lib/utils/cn'
import type { KeyTermDTO } from '@/types/api'

export function SourceSentenceDisclosure({ term }: { term: KeyTermDTO }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1 self-start rounded-sm text-body-sm font-medium text-brand hover:text-brand-700"
      >
        Why?
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-fast', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <div id={panelId} className="flex flex-col gap-1">
          {term.sourceSentence ? (
            <>
              <blockquote className="border-l-2 border-border-strong pl-3 text-body text-fg">
                &ldquo;{term.sourceSentence}&rdquo;
              </blockquote>
              {term.pageNumber && <p className="pl-3 text-body-sm text-fg-muted">From page {term.pageNumber}</p>}
              {!term.sourceVerified && (
                <p className="pl-3 text-body-sm text-warning-900">
                  We couldn&apos;t locate this exact sentence in the document — verify manually.
                </p>
              )}
            </>
          ) : (
            <p className="text-body-sm text-fg-muted">No supporting sentence was found in the document.</p>
          )}
        </div>
      )}
    </div>
  )
}
