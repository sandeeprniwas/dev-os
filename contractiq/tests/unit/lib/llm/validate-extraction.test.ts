import { describe, expect, it } from 'vitest'
import { buildMarkedText } from '@/lib/pdf/page-markers'
import type { ExtractionOutput, ExtractionTarget } from '@/lib/llm/schemas/extraction-output'
import { validateExtraction } from '@/lib/llm/validators/extraction'

const contractText = buildMarkedText([
  'This Agreement is entered into by Northwind Ltd and Bluepeak Inc.',
  'This Agreement shall remain in effect for two (2) years from the Effective Date.',
  'This Agreement is governed by the laws of the State of New York.',
])

const targets: ExtractionTarget[] = [
  { term_key: 'parties', term_name: 'Parties', definition: 'x' },
  { term_key: 'term_and_duration', term_name: 'Term & Duration', definition: 'x' },
  { term_key: 'governing_law', term_name: 'Governing Law', definition: 'x' },
  { term_key: 'custom_auto_renewal', term_name: 'Auto-renewal', definition: null },
]

const term = (overrides: Partial<ExtractionOutput['terms'][number]>): ExtractionOutput['terms'][number] => ({
  term_key: 'parties',
  term_name: 'Parties',
  value: 'Northwind Ltd and Bluepeak Inc.',
  page_number: 1,
  confidence_score: 95,
  source_sentence: 'This Agreement is entered into by Northwind Ltd and Bluepeak Inc.',
  ...overrides,
})

const run = (terms: ExtractionOutput['terms']) =>
  validateExtraction({ detected_type: 'nda', terms }, { targets, contractText, pageCount: 3 })

describe('validateExtraction', () => {
  it('returns exactly one result per target, in target order, back-filling missing ones', () => {
    const { terms } = run([term({ term_key: 'governing_law', term_name: 'x', page_number: 3, source_sentence: 'This Agreement is governed by the laws of the State of New York.', value: 'New York' })])
    expect(terms.map((t) => t.term_key)).toEqual(['parties', 'term_and_duration', 'governing_law', 'custom_auto_renewal'])
    expect(terms[0]).toMatchObject({ value: null, page_number: null, confidence_score: 0, source_verified: false })
    expect(terms[2]).toMatchObject({ term_name: 'Governing Law', value: 'New York', source_verified: true, confidence_score: 95 })
  })

  it('marks custom terms and sort order', () => {
    const { terms } = run([])
    expect(terms[3]).toMatchObject({ is_custom: true, sort_order: 3 })
    expect(terms[0].is_custom).toBe(false)
  })

  it('keeps the first of duplicate keys and drops unknown keys', () => {
    const { terms } = run([term({ value: 'first' }), term({ value: 'second' }), term({ term_key: 'invented' })])
    expect(terms[0].value).toBe('first')
    expect(terms).toHaveLength(4)
  })

  it('caps confidence at 49 when the source sentence is not in the document', () => {
    const { terms } = run([term({ source_sentence: 'Totally invented sentence that is not in this contract at all.' })])
    expect(terms[0]).toMatchObject({ source_verified: false, confidence_score: 49 })
  })

  it('caps confidence at 49 when a value has no source sentence', () => {
    expect(run([term({ source_sentence: null })]).terms[0].confidence_score).toBe(49)
  })

  it('corrects the page number to where the sentence was actually found', () => {
    const { terms } = run([
      term({ term_key: 'term_and_duration', page_number: 3, source_sentence: 'This Agreement shall remain in effect for two (2) years from the Effective Date.' }),
    ])
    expect(terms[1]).toMatchObject({ page_number: 2, source_verified: true })
  })

  it('nulls out-of-range pages and caps confidence at 40 when unverifiable', () => {
    const { terms } = run([term({ page_number: 9, source_sentence: 'Not in the contract sentence for testing purposes only.' })])
    expect(terms[0]).toMatchObject({ page_number: null, confidence_score: 40 })
  })

  it('treats empty values as not found and caps confidence at 20', () => {
    expect(run([term({ value: '   ', confidence_score: 80 })]).terms[0]).toMatchObject({ value: null, confidence_score: 20, page_number: null })
  })

  it('clamps and rounds confidence', () => {
    expect(run([term({ confidence_score: 140 })]).terms[0].confidence_score).toBe(100)
    expect(run([term({ confidence_score: 87.6 })]).terms[0].confidence_score).toBe(88)
  })

  it('truncates very long values at a word boundary', () => {
    const value = 'word '.repeat(100)
    const result = run([term({ value })]).terms[0].value!
    expect(result.length).toBeLessThanOrEqual(300)
    expect(result.endsWith('…')).toBe(true)
  })

  it('passes detected type through', () => {
    expect(validateExtraction({ detected_type: 'other', terms: [] }, { targets, contractText, pageCount: 3 }).detectedType).toBe('other')
  })
})
