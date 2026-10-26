import 'server-only'
import { buildMarkedText } from './page-markers'

export type ExtractedPdf = { markedText: string; pages: string[]; pageCount: number; wordCount: number }

export type TextItem = { str: string; transform: number[]; hasEOL?: boolean }

export class PdfExtractionError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = 'PdfExtractionError'
  }
}

/** Joins pdf.js text items, starting a new line on an explicit EOL or when the baseline (transform[5]) moves. */
export function itemsToText(items: TextItem[]): string {
  let text = ''
  let lastY: number | null = null
  let pendingBreak = false
  for (const item of items) {
    const y = item.transform?.[5] ?? 0
    if (text && (pendingBreak || (lastY !== null && Math.abs(y - lastY) > 1))) {
      text += '\n'
    } else if (text && !/[\s-]$/.test(text) && item.str && !/^\s/.test(item.str)) {
      text += ' '
    }
    text += item.str
    lastY = y
    pendingBreak = Boolean(item.hasEOL)
  }
  return text
}

/** Cleans one page of extracted text and removes literal page markers (prevents marker spoofing). */
export function cleanPageText(input: string): string {
  return input
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .replace(/\[PAGE \d+\]/gi, '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, '').replace(/[ \t]{2,}/g, ' '))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length
}

/**
 * Extracts text page by page with [PAGE N] markers using pdf.js (pdfjs-dist legacy build, Node-safe).
 * Supports classic and compressed (object-stream) PDFs. When the document has more than `maxPages`
 * pages, returns early with only `pageCount` so callers can reject it without extracting everything.
 * Throws PdfExtractionError for corrupt, encrypted or otherwise unreadable files.
 */
export async function extractText(buffer: Buffer, options: { maxPages?: number } = {}): Promise<ExtractedPdf> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  // pdf.js may transfer (detach) the array it is given, so always pass a private copy.
  const data = new Uint8Array(buffer.byteLength)
  data.set(buffer)

  let document
  try {
    document = await getDocument({
      data,
      isEvalSupported: false,
      useSystemFonts: false,
      disableFontFace: true,
      verbosity: 0,
    }).promise
  } catch (error) {
    throw new PdfExtractionError('Unreadable PDF', error)
  }

  try {
    const pageCount = document.numPages
    if (options.maxPages !== undefined && pageCount > options.maxPages) {
      return { markedText: '', pages: [], pageCount, wordCount: 0 }
    }

    const pages: string[] = []
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      try {
        const page = await document.getPage(pageNumber)
        const content = await page.getTextContent()
        const items = content.items.filter((item): item is TextItem & typeof item => 'str' in item)
        pages.push(cleanPageText(itemsToText(items)))
        page.cleanup()
      } catch {
        pages.push('')
      }
    }

    return {
      markedText: buildMarkedText(pages),
      pages,
      pageCount,
      wordCount: countWords(pages.join(' ')),
    }
  } finally {
    await document.destroy()
  }
}
