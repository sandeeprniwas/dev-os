import { describe, expect, it } from 'vitest'
import { buildTargets, parseCompletion } from '@/lib/services/extraction.service'
import { RetryableLLMError } from '@/lib/llm/with-retry'
import { STANDARD_TERMS } from '@/lib/constants/standard-terms'

describe('buildTargets', () => {
  it('lists the 10 NDA / 12 MSA standard terms in PRD order', () => {
    expect(buildTargets('nda', []).map((t) => t.term_name)).toEqual(STANDARD_TERMS.nda.map((t) => t.name))
    expect(buildTargets('msa', [])).toHaveLength(12)
  })

  it('appends custom terms with collision-safe keys and no definition', () => {
    const targets = buildTargets('nda', ['Non-compete radius', 'Non compete radius!'])
    expect(targets.slice(-2)).toEqual([
      { term_key: 'custom_non_compete_radius', term_name: 'Non-compete radius', definition: null },
      { term_key: 'custom_non_compete_radius_2', term_name: 'Non compete radius!', definition: null },
    ])
  })
})

describe('parseCompletion', () => {
  const valid = JSON.stringify({ detected_type: 'nda', terms: [] })

  it('parses valid JSON', () => {
    expect(parseCompletion({ content: valid, refusal: null, finishReason: 'stop', usage: null })).toEqual({ detected_type: 'nda', terms: [] })
  })

  it('returns null for invalid JSON or schema mismatch (triggers repair)', () => {
    expect(parseCompletion({ content: '{oops', refusal: null, finishReason: 'stop', usage: null })).toBeNull()
    expect(parseCompletion({ content: '{"terms": 3}', refusal: null, finishReason: 'stop', usage: null })).toBeNull()
  })

  it('throws LLM_REFUSED on refusal or content filter', () => {
    expect(() => parseCompletion({ content: null, refusal: 'no', finishReason: 'stop', usage: null })).toThrow(
      expect.objectContaining({ code: 'LLM_REFUSED' }),
    )
    expect(() => parseCompletion({ content: valid, refusal: null, finishReason: 'content_filter', usage: null })).toThrow(
      expect.objectContaining({ code: 'LLM_REFUSED' }),
    )
  })

  it('throws a retryable error on truncated output', () => {
    expect(() => parseCompletion({ content: '{', refusal: null, finishReason: 'length', usage: null })).toThrow(RetryableLLMError)
  })
})
