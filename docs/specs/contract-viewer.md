# Spec — Contract Viewer: PDF + Text Fallback (S8)

**Source:** US-006, FR-06, FR-07 · PRD §5 (storage non-blocking), external-dependency risk "PDF.js rendering" · engineering-doc §4.7, §5.1, §5.5 · **Release:** v0.3

## 1. Goal
Always show the contract next to the terms:
- **Primary:** an interactive PDF.js viewer, using a 1-hour signed URL.
- **Fallback:** a paginated text viewer built from `contract_text`'s `[PAGE N]` markers. It is used when storage is unavailable, the file was purged, or the PDF fails to render.

Both viewers respond identically to the shared `target` (page + highlight text) from `reviewStore`.

## 2. Files
| File | Purpose |
|---|---|
| `components/viewer/ContractViewer.tsx` | Chooses PDF vs text; owns the fallback state |
| `components/viewer/PdfViewer.tsx` | `'use client'`; react-pdf, loaded with `next/dynamic` (`ssr: false`) |
| `components/viewer/TextViewer.tsx` | Fallback renderer |
| `components/viewer/ViewerToolbar.tsx` | Page indicator, zoom, download |
| `components/viewer/use-page-navigation.ts` | Shared scroll + visible-page tracking |
| `components/viewer/highlight.ts` | Text-layer and plain-text highlighting helpers |
| `lib/pdf/page-markers.ts` | `splitPages`, `normalise`, `findSentencePage` (upload spec §6) |

## 3. Contract
```ts
interface ViewerProps {
  pageCount: number
  target: { page: number | null; text: string | null; nonce: number }
  zoom: number
  onVisiblePageChange(page: number): void
}
interface ContractViewerProps { signedUrl: string | null; contractText: string; pageCount: number; title: string }
```
`ContractViewer` renders `PdfViewer` when `signedUrl && !pdfFailed`, otherwise `TextViewer`. When `PdfViewer` fails it calls `onFatalError` → `setPdfFailed(true)`, and a notice is shown above the text viewer.

## 4. PdfViewer
- **Setup:**
  ```ts
  import { Document, Page, pdfjs } from 'react-pdf'
  import 'react-pdf/dist/Page/TextLayer.css'
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  ```
  `next.config.mjs` aliases `canvas` to false (foundation §2). The component is imported with `dynamic(() => import('./PdfViewer'), { ssr: false, loading: () => <ViewerSkeleton/> })`.
- `<Document file={signedUrl} onLoadError={handleError} onSourceError={handleError} loading={<ViewerSkeleton/>}>`.
- **Lazy pages:**
  - Every page has a wrapper `div[data-page=n]` sized from the first page's viewport aspect ratio × width × zoom.
  - An `IntersectionObserver` (`rootMargin: '100% 0px'`) marks pages visible.
  - Only visible ±1 pages mount `<Page pageNumber={n} width={containerWidth * zoom} renderTextLayer renderAnnotationLayer={false} />`.
- **Width:** a `ResizeObserver` on the scroll container, debounced 150 ms.
- **Toolbar** (`ViewerToolbar`, sticky, `h-12 bg-surface border-b border-border`):
  - "Page {visible} / {pageCount}" with an editable page input (Enter jumps).
  - Zoom − / + (0.5–2.0, step 0.25) and "Fit width" (zoom 1).
  - "Download PDF" (`<a href={signedUrl} download>`).
- **Highlight** (after `onRenderTextLayerSuccess` for the target page):
  1. Collect the page's text-layer `span`s and build the concatenated normalised string with a span-offset map.
  2. Find `normalise(target.text)`. If not found, try its first 80 chars.
  3. Add the class `term-highlight` to the covering spans and scroll the first one into view (`block: 'center'`).
  4. After 3 s, swap to `term-highlight-faded` (it stays until the next target).
  5. No match: add `animate-pulse-outline` (outline 2px brand) to the page wrapper for 2 s.
- **Errors:** `onLoadError`/`onSourceError`, or a 403 on fetch (expired URL), trigger:
  - Once: `queryClient.invalidateQueries(['contract', id])` to get a fresh URL.
  - Second failure: `onFatalError()`.

## 5. TextViewer
- `splitPages(contractText)` gives the pages. Each renders:
  ```html
  <section data-page="3" aria-label="Page 3" class="mb-4 rounded-lg border border-border bg-surface">
    <header class="sticky top-0 bg-surface border-b border-border px-4 py-2 text-body-sm text-fg-muted">Page 3</header>
    <div class="px-6 py-4 text-body-lg text-fg max-w-[72ch] whitespace-pre-wrap">…</div>
  </section>
  ```
- **Highlight:**
  1. `findSentencePage`-style matching on the target page's text gives the original-string offsets. (Keep an index map from normalised → original during normalisation.)
  2. Render the page text as `[before, <mark class="term-highlight">match</mark>, after]`.
  3. Fall back to the page pulse when there is no match.
- Zoom scales font size (`zoom × 16px`). There's no download link unless a `signedUrl` exists.
- **Notice above it** (when used as a fallback):

  | Cause | Notice |
  |---|---|
  | `signedUrl == null` | "The original PDF isn't available, so we're showing the extracted text." |
  | Render failure | "We couldn't display the original PDF. Showing extracted text instead." + "Download PDF" when a URL exists |

## 6. Navigation — `use-page-navigation.ts`
- Holds `pageRefs: Map<number, HTMLElement>`.
- `useEffect` on `target.nonce`: if `target.page`, run `pageRefs.get(page)?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })`. In PdfViewer this also mounts that page immediately (it marks the page visible before scrolling).
- Visible-page tracking: the observer picks the page with the largest intersection ratio, calls `onVisiblePageChange`, and updates the toolbar.
- `reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches`.

## 7. Edge cases
| Case | Behaviour |
|---|---|
| Storage upload failed (`file_path` NULL) | TextViewer + notice. No download |
| PDF purged by 90-day retention | Same as above |
| Fonts/encoding make PDF.js fail | Fallback + notice + download |
| Signed URL expires mid-session | One silent refresh, then fallback |
| Target page beyond `pageCount` | Ignored |
| Highlight text spans a page break | Highlight on the target page only (partial match via the first 80 chars) |
| Very large PDF / low-memory mobile | Lazy rendering ±1 page; mobile banner (S15) |
| Same page clicked twice | `nonce` changes, so it re-scrolls and re-highlights |
| Text contains `<` / `&` | Rendered as text nodes (React escaping), never as HTML |

## 8. Acceptance criteria
- **AC-VW-01:** With storage available, the PDF renders all pages (lazily), scrolls, and zooms between 50 % and 200 % (US-006).
- **AC-VW-02:** Clicking a page reference or chat citation scrolls the active viewer to that page in ≤ 1 s and highlights the source sentence when one is given (FR-07).
- **AC-VW-03:** With `file_path = NULL`, the text viewer renders every page as a labelled section with the same navigation and highlight behaviour (FR-06).
- **AC-VW-04:** Forcing a PDF load error switches to the text viewer with the notice and a Download link.
- **AC-VW-05:** The toolbar page indicator tracks the most visible page while scrolling.
- **AC-VW-06:** With reduced motion, navigation is instant (no smooth scroll or pulse).
- **AC-VW-07:** Only visible ±1 pages are mounted as canvases (verified in a 20-page test).

## 9. Tests
- Unit: `splitPages` (missing or empty pages), the highlight offset mapper (normalised ↔ original), `TextViewer` scroll-on-nonce (jsdom + mocked `scrollIntoView`).
- E2E: page jump in both viewers. Simulate storage absence by deleting the object in the test, which forces the text viewer.
