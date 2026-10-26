'use client'

import { useEffect, useMemo, useState } from 'react'
import { splitPages } from '@/lib/pdf/page-markers'
import { cn } from '@/lib/utils/cn'
import { useReviewStore } from '@/stores/review-store'
import { findRange } from './highlight'
import { usePageNavigation } from './use-page-navigation'
import { ViewerToolbar } from './ViewerToolbar'

type TextViewerProps = {
  contractText: string
  pageCount: number
  title: string
  notice: string | null
  downloadUrl: string | null
}

const HIGHLIGHT_FADE_MS = 3000

/** Fallback viewer built from contract_text [PAGE N] markers; same navigation contract as PdfViewer. */
export function TextViewer({ contractText, pageCount, title, notice, downloadUrl }: TextViewerProps) {
  const { target, zoom, setZoom, goToPage } = useReviewStore()
  const pages = useMemo(() => splitPages(contractText), [contractText])
  const { containerRef, registerPage, visiblePage, reducedMotion } = usePageNavigation(target)
  const [faded, setFaded] = useState(false)
  const [pulsePage, setPulsePage] = useState<number | null>(null)

  const match = useMemo(() => {
    if (!target.page || !target.text) return null
    const page = pages.find((p) => p.page === target.page)
    if (!page) return null
    const range = findRange(page.text, target.text)
    return range ? { page: page.page, ...range } : null
    // target.nonce re-runs the match so repeated clicks re-highlight
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, target.page, target.text, target.nonce])

  useEffect(() => {
    setFaded(false)
    if (target.page && target.text && !match && !reducedMotion) {
      setPulsePage(target.page)
      const timer = setTimeout(() => setPulsePage(null), 2000)
      return () => clearTimeout(timer)
    }
    const timer = setTimeout(() => setFaded(true), HIGHLIGHT_FADE_MS)
    return () => clearTimeout(timer)
  }, [target.nonce, target.page, target.text, match, reducedMotion])

  return (
    <div className="flex h-full flex-col bg-page">
      <ViewerToolbar
        visiblePage={visiblePage}
        pageCount={pageCount}
        zoom={zoom}
        onZoom={setZoom}
        onGoToPage={goToPage}
        downloadUrl={downloadUrl}
        title={title}
      />
      {notice && (
        <p role="note" className="border-b border-border bg-subtle px-4 py-2 text-body-sm text-fg-muted">
          {notice}
        </p>
      )}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4" tabIndex={0} aria-label="Contract text">
        {pages.map(({ page, text }) => (
          <section
            key={page}
            ref={registerPage(page)}
            aria-label={`Page ${page}`}
            className={cn(
              'mx-auto mb-4 max-w-[80ch] rounded-lg border border-border bg-surface outline outline-2 outline-transparent',
              pulsePage === page && 'animate-pulse-outline',
            )}
          >
            <header className="sticky top-0 rounded-t-lg border-b border-border bg-surface px-4 py-2 text-body-sm text-fg-muted">
              Page {page}
            </header>
            <div
              className="whitespace-pre-wrap break-words px-6 py-4 text-fg"
              style={{ fontSize: `${16 * zoom}px`, lineHeight: `${24 * zoom}px` }}
            >
              {match && match.page === page ? (
                <>
                  {text.slice(0, match.start)}
                  <mark className={faded ? 'term-highlight-faded text-fg' : 'term-highlight text-fg'}>
                    {text.slice(match.start, match.end)}
                  </mark>
                  {text.slice(match.end)}
                </>
              ) : (
                text || <span className="italic text-fg-muted">This page has no extractable text.</span>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
