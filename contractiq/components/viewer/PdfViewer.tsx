'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import { useReviewStore } from '@/stores/review-store'
import { fadeHighlights, highlightTextLayer } from './highlight'
import { usePageNavigation } from './use-page-navigation'
import { ViewerToolbar } from './ViewerToolbar'

// Served from public/ (copied from the installed pdfjs-dist on postinstall) so the version always matches.
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

type PdfViewerProps = {
  signedUrl: string
  pageCount: number
  title: string
  onFatalError: () => void
  onExpiredUrl: () => void
}

const DEFAULT_ASPECT = 1.414 // A4 / Letter-ish height ÷ width until the first page loads
const HIGHLIGHT_FADE_MS = 3000

export default function PdfViewer({ signedUrl, pageCount, title, onFatalError, onExpiredUrl }: PdfViewerProps) {
  const { target, zoom, setZoom, goToPage } = useReviewStore()
  const { containerRef, registerPage, visiblePage, nearPages, reducedMotion } = usePageNavigation(target)
  const [width, setWidth] = useState(0)
  const [aspect, setAspect] = useState(DEFAULT_ASPECT)
  const [numPages, setNumPages] = useState(pageCount)
  const [pulsePage, setPulsePage] = useState<number | null>(null)
  const retriedUrl = useRef(false)
  const textLayers = useRef(new Map<number, HTMLElement>())

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    let timer: ReturnType<typeof setTimeout>
    const observer = new ResizeObserver(([entry]) => {
      clearTimeout(timer)
      timer = setTimeout(() => setWidth(Math.max(240, entry.contentRect.width - 32)), 150)
    })
    observer.observe(element)
    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [containerRef])

  const applyHighlight = useCallback(() => {
    if (!target.page || !target.text) return
    const layer = textLayers.current.get(target.page)
    if (!layer) return
    const first = highlightTextLayer(layer, target.text)
    if (first) {
      first.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })
      const timer = setTimeout(() => fadeHighlights(layer), HIGHLIGHT_FADE_MS)
      return () => clearTimeout(timer)
    }
    if (!reducedMotion) {
      setPulsePage(target.page)
      const timer = setTimeout(() => setPulsePage(null), 2000)
      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.page, target.text, target.nonce, reducedMotion])

  useEffect(() => applyHighlight(), [applyHighlight])

  function handleLoadError(error: Error) {
    const expired = /403|400|expired|signature/i.test(error.message)
    if (expired && !retriedUrl.current) {
      retriedUrl.current = true
      onExpiredUrl()
      return
    }
    onFatalError()
  }

  const pageWidth = Math.round(width * zoom)

  return (
    <div className="flex h-full flex-col bg-page">
      <ViewerToolbar
        visiblePage={visiblePage}
        pageCount={numPages}
        zoom={zoom}
        onZoom={setZoom}
        onGoToPage={goToPage}
        downloadUrl={signedUrl}
        title={title}
      />
      <div ref={containerRef} className="flex-1 overflow-auto p-4" tabIndex={0} aria-label="Contract PDF">
        <Document
          file={signedUrl}
          onLoadSuccess={(pdf) => setNumPages(pdf.numPages)}
          onLoadError={handleLoadError}
          onSourceError={handleLoadError}
          loading={<Skeleton className="mx-auto h-[80vh] w-full max-w-3xl" />}
          error={<span className="sr-only">The PDF could not be displayed.</span>}
        >
          {Array.from({ length: numPages }, (_, index) => {
            const page = index + 1
            const height = pageWidth > 0 ? Math.round(pageWidth * aspect) : undefined
            return (
              <div
                key={page}
                ref={registerPage(page)}
                aria-label={`Page ${page}`}
                className={cn(
                  'mx-auto mb-4 border border-border bg-surface outline outline-2 outline-transparent',
                  pulsePage === page && 'animate-pulse-outline',
                )}
                style={{ width: pageWidth || undefined, minHeight: height }}
              >
                {pageWidth > 0 && nearPages.has(page) && (
                  <Page
                    pageNumber={page}
                    width={pageWidth}
                    renderAnnotationLayer={false}
                    renderTextLayer
                    loading={<Skeleton className="w-full" />}
                    onLoadSuccess={(loaded) => {
                      if (page === 1 && loaded.originalWidth > 0) setAspect(loaded.originalHeight / loaded.originalWidth)
                    }}
                    onRenderTextLayerSuccess={() => {
                      const wrapper = containerRef.current?.querySelector<HTMLElement>(`[data-page="${page}"] .textLayer`)
                      if (wrapper) textLayers.current.set(page, wrapper)
                      if (page === target.page) applyHighlight()
                    }}
                  />
                )}
              </div>
            )
          })}
        </Document>
      </div>
    </div>
  )
}
