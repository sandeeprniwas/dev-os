export type PageText = { page: number; text: string }

const MARKER_LINE = /^\[PAGE (\d+)\]$/

/** Joins per-page text into the stored format: "[PAGE 1]\n…\n\n[PAGE 2]\n…". */
export function buildMarkedText(pages: string[]): string {
  return pages.map((text, index) => `[PAGE ${index + 1}]\n${text.trim()}`).join('\n\n')
}

/** Parses stored text back into pages. Tolerates empty pages; ignores text before the first marker. */
export function splitPages(markedText: string): PageText[] {
  const pages: PageText[] = []
  let current: PageText | null = null

  for (const line of markedText.split('\n')) {
    const marker = MARKER_LINE.exec(line.trim())
    if (marker) {
      if (current) pages.push({ page: current.page, text: current.text.trim() })
      current = { page: Number(marker[1]), text: '' }
    } else if (current) {
      current.text += (current.text ? '\n' : '') + line
    }
  }
  if (current) pages.push({ page: current.page, text: current.text.trim() })
  return pages
}

/** Normalised form used for fuzzy matching: lowercase, straight quotes, plain dashes, single spaces. */
export function normalise(input: string): string {
  return input
    .replace(/­/g, '')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * Normalises `input` and returns, for every character of the result, its index in the original string.
 * Used to map a match in normalised text back to the original (highlighting).
 */
export function normaliseWithMap(input: string): { text: string; map: number[] } {
  let text = ''
  const map: number[] = []
  let lastWasSpace = true

  for (let i = 0; i < input.length; i++) {
    let ch = input[i]
    if (ch === '­') continue
    if (/[‘’‚‛′]/.test(ch)) ch = "'"
    else if (/[“”„‟″]/.test(ch)) ch = '"'
    else if (/[‐-―−]/.test(ch)) ch = '-'

    if (/\s/.test(ch)) {
      if (lastWasSpace) continue
      ch = ' '
      lastWasSpace = true
    } else {
      lastWasSpace = false
    }
    text += ch.toLowerCase()
    map.push(i)
  }

  if (text.endsWith(' ')) {
    text = text.slice(0, -1)
    map.pop()
  }
  return { text, map }
}

const tokenize = (s: string) => s.split(' ').filter(Boolean)

/** Fraction of `needle` tokens found, in order-insensitive multiset form, within `window`. */
function tokenOverlap(needle: string[], window: string[]): number {
  const counts = new Map<string, number>()
  for (const token of window) counts.set(token, (counts.get(token) ?? 0) + 1)
  let hits = 0
  for (const token of needle) {
    const n = counts.get(token) ?? 0
    if (n > 0) {
      hits++
      counts.set(token, n - 1)
    }
  }
  return needle.length === 0 ? 0 : hits / needle.length
}

export type SentenceMatch = { page: number; exact: boolean }

/**
 * Finds which page contains `sentence`: exact normalised substring first, then a sliding-window
 * token overlap ≥ 0.9 (window = sentence length ± 20 %). Returns null when no page qualifies.
 */
export function findSentencePage(markedText: string, sentence: string, minOverlap = 0.9): SentenceMatch | null {
  const target = normalise(sentence)
  if (target.length < 8) return null
  const pages = splitPages(markedText).map((p) => ({ page: p.page, text: normalise(p.text) }))

  for (const page of pages) {
    if (page.text.includes(target)) return { page: page.page, exact: true }
  }

  const needle = tokenize(target)
  if (needle.length < 4) return null
  const minWindow = Math.max(1, Math.floor(needle.length * 0.8))
  const maxWindow = Math.ceil(needle.length * 1.2)

  let best: { page: number; score: number } | null = null
  for (const page of pages) {
    const tokens = tokenize(page.text)
    for (let size = minWindow; size <= maxWindow; size++) {
      for (let start = 0; start + size <= tokens.length; start++) {
        const score = tokenOverlap(needle, tokens.slice(start, start + size))
        if (score >= minOverlap && (!best || score > best.score)) best = { page: page.page, score }
      }
    }
  }
  return best ? { page: best.page, exact: false } : null
}
