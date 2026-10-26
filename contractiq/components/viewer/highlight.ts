import { normalise, normaliseWithMap } from '@/lib/pdf/page-markers'

export const HIGHLIGHT_CLASS = 'term-highlight'
export const HIGHLIGHT_FADED_CLASS = 'term-highlight-faded'

/** Candidate needles: the full sentence, then its first 80 normalised characters (cross-page / partial). */
function needles(text: string): string[] {
  const full = normalise(text)
  const head = full.slice(0, 80)
  return full.length > 80 ? [full, head] : [full]
}

/** Finds `text` inside `haystack` (original string) and returns the [start, end) range in the original. */
export function findRange(haystack: string, text: string): { start: number; end: number } | null {
  const { text: normalised, map } = normaliseWithMap(haystack)
  for (const needle of needles(text)) {
    if (needle.length < 4) continue
    const index = normalised.indexOf(needle)
    if (index !== -1) {
      const start = map[index]
      const end = map[index + needle.length - 1] + 1
      return { start, end }
    }
  }
  return null
}

export function clearHighlights(container: ParentNode): void {
  container.querySelectorAll(`.${HIGHLIGHT_CLASS}, .${HIGHLIGHT_FADED_CLASS}`).forEach((element) => {
    element.classList.remove(HIGHLIGHT_CLASS, HIGHLIGHT_FADED_CLASS)
  })
}

/**
 * Highlights the pdf.js text-layer spans covering `text`. Returns the first highlighted span, or null
 * when the text can't be located on this page.
 */
export function highlightTextLayer(textLayer: HTMLElement, text: string): HTMLElement | null {
  clearHighlights(textLayer)
  // Leaf spans only: pdf.js nests marked-content spans around the text spans.
  const spans = Array.from(textLayer.querySelectorAll<HTMLElement>('span')).filter(
    (span) => span.querySelector('span') === null && (span.textContent ?? '').length > 0,
  )
  if (spans.length === 0) return null

  let joined = ''
  const owners: number[] = []
  spans.forEach((span, index) => {
    const content = (span.textContent ?? '') + ' '
    joined += content
    for (let i = 0; i < content.length; i++) owners.push(index)
  })

  const range = findRange(joined, text)
  if (!range) return null

  const first = owners[range.start]
  const last = owners[Math.max(range.start, range.end - 1)]
  for (let i = first; i <= last; i++) spans[i].classList.add(HIGHLIGHT_CLASS)
  return spans[first]
}

export function fadeHighlights(container: ParentNode): void {
  container.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((element) => {
    element.classList.remove(HIGHLIGHT_CLASS)
    element.classList.add(HIGHLIGHT_FADED_CLASS)
  })
}
