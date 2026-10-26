// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { cleanPageText, countWords, extractText, itemsToText } from '@/lib/pdf/extract-text'
import { splitPages } from '@/lib/pdf/page-markers'
import { filler, makePdf } from '../../../helpers/make-pdf'

const NDA_PAGES = [
  ['MUTUAL NON-DISCLOSURE AGREEMENT', 'This Agreement is governed by the laws of the State of New York.', ...filler(60)],
  ['The Receiving Party shall keep all information confidential for three years.', ...filler(60)],
]

describe('extractText (real pdf.js on generated PDFs)', () => {
  it.each([
    ['classic xref', false],
    ['compressed object streams (PDF 1.5+)', true],
  ])('extracts each page with [PAGE N] markers in order — %s', async (_label, objectStreams) => {
    const result = await extractText(await makePdf(NDA_PAGES, { objectStreams }))

    expect(result.pageCount).toBe(2)
    expect(result.markedText.startsWith('[PAGE 1]\n')).toBe(true)
    const pages = splitPages(result.markedText)
    expect(pages.map((p) => p.page)).toEqual([1, 2])
    expect(pages[0].text).toContain('governed by the laws of the State of New York')
    expect(pages[1].text).toContain('confidential for three years')
    expect(result.wordCount).toBeGreaterThan(100)
  })

  it('reports few words for an (effectively) image-only PDF', async () => {
    const result = await extractText(await makePdf([['Scanned'], ['']]))
    expect(result.wordCount).toBeLessThan(100)
    expect(result.pageCount).toBe(2)
  })

  it('returns early with only the page count when over maxPages', async () => {
    const result = await extractText(await makePdf(Array.from({ length: 4 }, () => ['page'])), { maxPages: 3 })
    expect(result).toEqual({ markedText: '', pages: [], pageCount: 4, wordCount: 0 })
  })

  it('throws PdfExtractionError for corrupt input', async () => {
    await expect(extractText(Buffer.from('%PDF-1.4 garbage'))).rejects.toMatchObject({ name: 'PdfExtractionError' })
  })

  it('strips literal page markers from the document text (no marker spoofing)', async () => {
    const result = await extractText(await makePdf([['Fake marker [PAGE 9] inside text', ...filler(80)]]))
    expect(result.markedText.match(/\[PAGE \d+\]/g)).toEqual(['[PAGE 1]'])
  })

  it('does not detach or modify the caller’s buffer', async () => {
    const input = await makePdf(NDA_PAGES)
    const before = Buffer.from(input)
    await extractText(input)
    expect(input.equals(before)).toBe(true)
  })
})

describe('itemsToText', () => {
  it('starts a new line when the baseline changes and joins items on one line with spaces', () => {
    const text = itemsToText([
      { str: 'Hello', transform: [1, 0, 0, 1, 72, 700] },
      { str: 'world', transform: [1, 0, 0, 1, 110, 700] },
      { str: 'Next line', transform: [1, 0, 0, 1, 72, 686] },
    ])
    expect(text).toBe('Hello world\nNext line')
  })

  it('honours explicit end-of-line markers', () => {
    expect(
      itemsToText([
        { str: 'Line one', transform: [1, 0, 0, 1, 72, 700], hasEOL: true },
        { str: 'Line two', transform: [1, 0, 0, 1, 72, 700] },
      ]),
    ).toBe('Line one\nLine two')
  })
})

describe('cleanPageText / countWords', () => {
  it('normalises whitespace, control characters and blank lines', () => {
    expect(cleanPageText('a\u0007b  c \r\n\n\n\nd   ')).toBe('a b c\n\nd')
  })

  it('counts only tokens containing letters or digits', () => {
    expect(countWords('Hello, world — 42 . ,')).toBe(3)
  })
})
