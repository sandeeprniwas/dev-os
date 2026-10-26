import { describe, expect, it } from 'vitest'
import { buildMarkedText, findSentencePage, normalise, normaliseWithMap, splitPages } from '@/lib/pdf/page-markers'

const TEXT = buildMarkedText([
  'This Agreement is made between Acme Ltd and Beta Inc.',
  'The obligations shall survive for three (3) years after termination.',
  '',
  'This Agreement is governed by the laws of England and Wales.',
])

describe('buildMarkedText / splitPages', () => {
  it('round-trips pages, including empty ones', () => {
    const pages = splitPages(TEXT)
    expect(pages).toHaveLength(4)
    expect(pages[2]).toEqual({ page: 3, text: '' })
    expect(pages[3].text).toBe('This Agreement is governed by the laws of England and Wales.')
  })

  it('ignores text before the first marker', () => {
    expect(splitPages('preamble\n[PAGE 1]\nbody')).toEqual([{ page: 1, text: 'body' }])
  })
})

describe('normalise', () => {
  it('lowercases and straightens quotes, dashes and whitespace', () => {
    expect(normalise('  “Hello”  — it’s  ')).toBe('"hello" - it\'s')
  })

  it('normaliseWithMap maps every normalised character back to the original', () => {
    const original = 'A  “B”'
    const { text, map } = normaliseWithMap(original)
    expect(text).toBe('a "b"')
    expect(map.map((i) => original[i])).toEqual(['A', ' ', '“', 'B', '”'])
  })
})

describe('findSentencePage', () => {
  it('finds an exact (normalised) sentence and its page', () => {
    expect(findSentencePage(TEXT, 'the obligations shall survive for three (3) years after termination.')).toEqual({ page: 2, exact: true })
  })

  it('matches with curly quotes / extra whitespace differences', () => {
    expect(findSentencePage(TEXT, 'This  Agreement is governed by the laws of England and Wales')?.page).toBe(4)
  })

  it('fuzzy-matches a lightly paraphrased sentence (≥ 90 % token overlap)', () => {
    const match = findSentencePage(TEXT, 'The obligations shall survive for three (3) years after any termination.')
    expect(match).toEqual({ page: 2, exact: false })
  })

  it('returns null for an invented sentence', () => {
    expect(findSentencePage(TEXT, 'Either party may terminate on ninety days written notice to the other.')).toBeNull()
  })

  it('returns null for very short input', () => {
    expect(findSentencePage(TEXT, 'Acme')).toBeNull()
  })
})
