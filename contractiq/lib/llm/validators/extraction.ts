import { findSentencePage } from '@/lib/pdf/page-markers'
import type { DetectedContractType } from '@/types/domain'
import type { ExtractionOutput, ExtractionTarget } from '../schemas/extraction-output'

export type ValidatedTerm = {
  term_key: string
  term_name: string
  value: string | null
  page_number: number | null
  confidence_score: number
  source_sentence: string | null
  source_verified: boolean
  is_custom: boolean
  sort_order: number
}

const MAX_VALUE_CHARS = 300
const UNVERIFIED_CAP = 49
const BAD_PAGE_CAP = 40
const NULL_VALUE_CAP = 20

function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

const clampScore = (n: number) => Math.min(100, Math.max(0, Math.round(Number.isFinite(n) ? n : 0)))

/**
 * Grounds the model output in the document (key-term-extraction spec §6): one result per target in
 * target order, page range checked, verbatim source sentences verified against the stored text, and
 * confidence capped whenever evidence can't be verified.
 */
export function validateExtraction(
  raw: ExtractionOutput,
  ctx: { targets: ExtractionTarget[]; contractText: string; pageCount: number },
): { detectedType: DetectedContractType; terms: ValidatedTerm[] } {
  const byKey = new Map<string, ExtractionOutput['terms'][number]>()
  for (const term of raw.terms) {
    if (!byKey.has(term.term_key)) byKey.set(term.term_key, term)
  }

  const terms = ctx.targets.map((target, index): ValidatedTerm => {
    const found = byKey.get(target.term_key)
    const base = {
      term_key: target.term_key,
      term_name: target.term_name,
      is_custom: target.term_key.startsWith('custom_'),
      sort_order: index,
    }

    const rawValue = found?.value?.trim() ? found.value.trim() : null
    if (!found || rawValue === null) {
      return {
        ...base,
        value: null,
        page_number: null,
        source_sentence: null,
        source_verified: false,
        confidence_score: Math.min(clampScore(found?.confidence_score ?? 0), NULL_VALUE_CAP),
      }
    }

    let confidence = clampScore(found.confidence_score)
    let page = found.page_number
    if (page !== null && (page < 1 || page > ctx.pageCount)) {
      page = null
      confidence = Math.min(confidence, BAD_PAGE_CAP)
    }

    const sentence = found.source_sentence?.trim() || null
    let verified = false
    if (sentence) {
      const match = findSentencePage(ctx.contractText, sentence)
      if (match) {
        verified = true
        page = match.page
      }
    }
    if (!verified) confidence = Math.min(confidence, UNVERIFIED_CAP)

    return {
      ...base,
      value: truncateAtWord(rawValue, MAX_VALUE_CHARS),
      page_number: page,
      source_sentence: sentence,
      source_verified: verified,
      confidence_score: confidence,
    }
  })

  return { detectedType: raw.detected_type, terms }
}
