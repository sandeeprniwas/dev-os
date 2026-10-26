import { describe, expect, it } from 'vitest'
import { ensurePrefix, extractCitedPages, isNotFoundAnswer, NOT_FOUND_ANSWER, splitCitations } from '@/lib/llm/citations'
import { classifyQuery } from '@/lib/llm/classify-query'
import { buildChatMessages } from '@/lib/llm/prompts/chat'

describe('classifyQuery', () => {
  it.each([
    ['Is there an auto-renewal clause?', 'contract'],
    ['What is the liability cap?', 'contract'],
    ['Summarise it for me', 'contract'],
    ['What did you say earlier?', 'history'],
    ['Can you repeat your last answer', 'history'],
    ['What did you say earlier about the liability cap?', 'both'],
    ['You mentioned termination before — which section?', 'both'],
  ] as const)('%s → %s', (question, expected) => {
    expect(classifyQuery(question)).toBe(expected)
  })
})

describe('citations', () => {
  it('extracts unique sorted pages within range', () => {
    expect(extractCitedPages('See [Page 4] and [page 2], also [Page 4] and [Page 25].', 6)).toEqual([2, 4])
  })

  it('splits text into text and page parts', () => {
    expect(splitCitations('A [Page 3] b')).toEqual([
      { type: 'text', value: 'A ' },
      { type: 'page', page: 3 },
      { type: 'text', value: ' b' },
    ])
  })

  it('enforces the "Based on the document" prefix', () => {
    expect(ensurePrefix('The term is two years [Page 2].')).toBe('Based on the document, the term is two years [Page 2].')
    expect(ensurePrefix('Based on the document, yes.')).toBe('Based on the document, yes.')
  })

  it('canonicalises the not-found answer', () => {
    expect(ensurePrefix('i cannot find this in the document')).toBe(NOT_FOUND_ANSWER)
    expect(isNotFoundAnswer(NOT_FOUND_ANSWER)).toBe(true)
    expect(isNotFoundAnswer('I cannot find this in the document, but…')).toBe(false)
  })
})

describe('buildChatMessages', () => {
  const base = {
    title: 'Acme NDA',
    contractType: 'nda' as const,
    pageCount: 2,
    contractText: '[PAGE 1]\nHello',
    message: 'What did you say earlier?',
    queryClass: 'history' as const,
  }

  it('orders system prompt, contract, history, then the new turn with its hint', () => {
    const { messages } = buildChatMessages({
      ...base,
      history: [
        { role: 'user', content: 'Q1' },
        { role: 'assistant', content: 'A1' },
      ],
    })
    expect(messages.map((m) => m.role)).toEqual(['system', 'system', 'user', 'assistant', 'user'])
    expect(String(messages[1].content)).toContain('<contract title="Acme NDA" type="nda" pages="2">')
    expect(String(messages[4].content)).toContain('Answer from our conversation so far')
  })

  it('drops the oldest history when over the token budget', () => {
    const huge = 'word '.repeat(120_000) // ≈ 120k tokens, over the 100k prompt budget
    const { messages, droppedHistory } = buildChatMessages({
      ...base,
      history: [
        { role: 'user', content: huge },
        { role: 'assistant', content: 'recent answer' },
      ],
    })
    expect(droppedHistory).toBe(1)
    expect(messages.some((m) => m.content === 'recent answer')).toBe(true)
  })
})
