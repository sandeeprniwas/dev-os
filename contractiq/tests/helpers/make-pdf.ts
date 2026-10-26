import { PDFDocument, StandardFonts } from 'pdf-lib'

/**
 * Builds a real text-layer PDF for tests (one text block per page, Helvetica 11pt).
 * `objectStreams: true` produces the compressed PDF 1.5 structure most modern tools emit.
 */
export async function makePdf(pages: string[][], options: { objectStreams?: boolean } = {}): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (const lines of pages) {
    const page = doc.addPage([612, 792])
    lines.forEach((line, index) => {
      page.drawText(line, { x: 72, y: 720 - index * 14, size: 11, font })
    })
  }
  const bytes = await doc.save({ useObjectStreams: options.objectStreams ?? false })
  return Buffer.from(bytes)
}

/** Repeats a clause to reach a realistic word count per page. */
export function filler(words: number, seed = 'The parties agree to cooperate in good faith'): string[] {
  const lines: string[] = []
  let count = 0
  while (count < words) {
    lines.push(`${seed}.`)
    count += seed.split(' ').length
  }
  return lines
}
