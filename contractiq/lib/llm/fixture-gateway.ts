import { normalise, splitPages } from '@/lib/pdf/page-markers'
import { NOT_FOUND_ANSWER } from './citations'
import type { ChatStreamChunk, LlmGateway, LlmMessage } from './gateway'
import type { ExtractionTarget, ExtractionWire } from './schemas/extraction-output'

/*
 * Deterministic stand-in for OpenAI used when LLM_MODE=fixture (E2E tests, offline demos).
 * It derives answers from the contract text itself so the full pipeline — validation, verification,
 * persistence, streaming — runs exactly as in production without network calls.
 */

const STOPWORDS = new Set(['the', 'and', 'of', 'to', 'a', 'an', 'in', 'is', 'are', 'what', 'how', 'does', 'do', 'for', 'there', 'any', 'this', 'with', 'can', 'i', 'my', 'it'])

function messageText(message: LlmMessage): string {
  return typeof message.content === 'string' ? message.content : ''
}

function tagContent(messages: LlmMessage[], tag: string): string {
  for (const message of messages) {
    const match = new RegExp(`<${tag}[^>]*>\\n?([\\s\\S]*?)\\n?</${tag}>`).exec(messageText(message))
    if (match) return match[1]
  }
  return ''
}

function sentences(markedText: string): { page: number; sentence: string }[] {
  return splitPages(markedText).flatMap(({ page, text }) =>
    text
      .replace(/\n+/g, ' ')
      .split(/(?<=[.;])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length >= 20)
      .map((sentence) => ({ page, sentence })),
  )
}

function keywords(text: string): string[] {
  return normalise(text)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word))
}

function bestSentence(pool: { page: number; sentence: string }[], words: string[]) {
  let best: { page: number; sentence: string; score: number } | null = null
  for (const candidate of pool) {
    const haystack = normalise(candidate.sentence)
    const score = words.filter((word) => haystack.includes(word)).length
    if (score > 0 && (!best || score > best.score)) best = { ...candidate, score }
  }
  return best
}

function extract(contractText: string, targets: ExtractionTarget[], contractType: string): ExtractionWire {
  const pool = sentences(contractText)
  return {
    detected_type: contractType === 'msa' ? 'msa' : 'nda',
    terms: targets.map((target) => {
      const words = keywords(target.term_name)
      const best = bestSentence(pool, words)
      if (!best) {
        return { term_key: target.term_key, term_name: target.term_name, value: null, page_number: null, confidence_score: 0, source_sentence: null }
      }
      const coverage = best.score / Math.max(1, words.length)
      return {
        term_key: target.term_key,
        term_name: target.term_name,
        value: best.sentence.length > 160 ? `${best.sentence.slice(0, 157)}…` : best.sentence,
        page_number: best.page,
        confidence_score: Math.round(45 + coverage * 50),
        source_sentence: best.sentence,
      }
    }),
  }
}

export const fixtureGateway: LlmGateway = {
  model: 'gpt-4o',

  async completeJson({ messages }) {
    const contractText = tagContent(messages, 'contract')
    const contractType = /<contract type="(\w+)"/.exec(messages.map(messageText).join('\n'))?.[1] ?? 'nda'
    let targets: ExtractionTarget[] = []
    try {
      targets = JSON.parse(tagContent(messages, 'target_terms') || '[]') as ExtractionTarget[]
    } catch {
      targets = []
    }
    const content = JSON.stringify(extract(contractText, targets, contractType))
    return {
      content,
      refusal: null,
      finishReason: 'stop',
      usage: { prompt_tokens: 0, completion_tokens: 0, prompt_tokens_details: { cached_tokens: 0 } },
    }
  },

  async *streamChat({ messages }): AsyncGenerator<ChatStreamChunk> {
    const contractText = tagContent(messages, 'contract')
    const question = messageText(messages[messages.length - 1]).replace(/\n\n\(.*\)$/s, '')
    const best = bestSentence(sentences(contractText), keywords(question))
    const answer =
      best && best.score >= 2 ? `Based on the document, "${best.sentence}" [Page ${best.page}]` : NOT_FOUND_ANSWER

    for (const piece of answer.match(/\S+\s*/g) ?? [answer]) {
      yield { type: 'delta', text: piece }
    }
    yield {
      type: 'end',
      finishReason: 'stop',
      refusal: null,
      usage: { prompt_tokens: 0, completion_tokens: 0, prompt_tokens_details: { cached_tokens: 0 } },
    }
  },
}
