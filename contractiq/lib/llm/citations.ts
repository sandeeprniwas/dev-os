export const NOT_FOUND_ANSWER = 'I cannot find this in the document.'

const CITATION = /\[Page\s+(\d+)\]/gi

/** Unique, sorted page numbers cited as [Page N], limited to pages that exist. */
export function extractCitedPages(text: string, pageCount: number): number[] {
  const pages = new Set<number>()
  for (const match of text.matchAll(CITATION)) {
    const page = Number(match[1])
    if (Number.isInteger(page) && page >= 1 && page <= pageCount) pages.add(page)
  }
  return [...pages].sort((a, b) => a - b)
}

export function isNotFoundAnswer(text: string): boolean {
  return /^i cannot find this in the document\.?$/i.test(text.trim())
}

/** Enforces the "Based on the document…" framing (PRD §9) and canonicalises the not-found answer. */
export function ensurePrefix(text: string): string {
  const trimmed = text.trim()
  if (isNotFoundAnswer(trimmed)) return NOT_FOUND_ANSWER
  if (/^based on the document/i.test(trimmed)) return trimmed
  return `Based on the document, ${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`
}

/** Splits text into plain segments and page citations, for rendering inline citation chips. */
export function splitCitations(text: string): ({ type: 'text'; value: string } | { type: 'page'; page: number })[] {
  const parts: ({ type: 'text'; value: string } | { type: 'page'; page: number })[] = []
  let lastIndex = 0
  for (const match of text.matchAll(CITATION)) {
    const index = match.index ?? 0
    if (index > lastIndex) parts.push({ type: 'text', value: text.slice(lastIndex, index) })
    parts.push({ type: 'page', page: Number(match[1]) })
    lastIndex = index + match[0].length
  }
  if (lastIndex < text.length) parts.push({ type: 'text', value: text.slice(lastIndex) })
  return parts
}
