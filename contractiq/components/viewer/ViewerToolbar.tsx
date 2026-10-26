'use client'

import { Download, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useState } from 'react'
import { IconButton } from '@/components/ui/IconButton'
import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP } from '@/stores/review-store'

type ViewerToolbarProps = {
  visiblePage: number
  pageCount: number
  zoom: number
  onZoom: (zoom: number) => void
  onGoToPage: (page: number) => void
  downloadUrl: string | null
  title: string
}

export function ViewerToolbar({ visiblePage, pageCount, zoom, onZoom, onGoToPage, downloadUrl, title }: ViewerToolbarProps) {
  const [pageInput, setPageInput] = useState(String(visiblePage))
  useEffect(() => setPageInput(String(visiblePage)), [visiblePage])

  return (
    <div className="sticky top-0 z-10 flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-3">
      <form
        className="flex items-center gap-1 text-body text-fg-muted"
        onSubmit={(event) => {
          event.preventDefault()
          const page = Number(pageInput)
          if (Number.isInteger(page) && page >= 1 && page <= pageCount) onGoToPage(page)
          else setPageInput(String(visiblePage))
        }}
      >
        <label htmlFor="viewer-page" className="sr-only">
          Page number
        </label>
        <input
          id="viewer-page"
          inputMode="numeric"
          value={pageInput}
          onChange={(event) => setPageInput(event.target.value.replace(/\D/g, '').slice(0, 3))}
          onBlur={() => setPageInput(String(visiblePage))}
          className="h-8 w-10 rounded-md border border-border bg-surface text-center text-body text-fg focus:border-border-focus focus:outline-none"
        />
        <span aria-hidden="true">/ {pageCount}</span>
      </form>
      <div className="flex items-center gap-1">
        <IconButton label="Zoom out" icon={<ZoomOut />} disabled={zoom <= MIN_ZOOM} onClick={() => onZoom(zoom - ZOOM_STEP)} />
        <span className="w-12 text-center text-body-sm text-fg-muted" aria-live="polite">
          {Math.round(zoom * 100)}%
        </span>
        <IconButton label="Zoom in" icon={<ZoomIn />} disabled={zoom >= MAX_ZOOM} onClick={() => onZoom(zoom + ZOOM_STEP)} />
        <IconButton label="Fit width" icon={<Maximize2 />} onClick={() => onZoom(1)} />
        {downloadUrl && (
          <a
            href={downloadUrl}
            download={`${title}.pdf`}
            aria-label="Download PDF"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg hover:bg-subtle"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  )
}
