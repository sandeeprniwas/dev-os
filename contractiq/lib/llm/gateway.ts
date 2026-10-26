import 'server-only'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { getEnv } from '@/lib/env'
import { getLlmModel, getOpenAI } from './client'
import type { TokenUsage } from './cost'
import { fixtureGateway } from './fixture-gateway'

export type LlmMessage = ChatCompletionMessageParam

export type JsonCompletionRequest = {
  messages: LlmMessage[]
  responseFormat: { type: 'json_schema'; json_schema: { name: string; strict?: boolean | null; schema?: Record<string, unknown> } }
  temperature: number
  maxTokens: number
  user: string
  timeoutMs: number
}

export type CompletionResult = {
  content: string | null
  refusal: string | null
  finishReason: string | null
  usage: TokenUsage | null
}

export type ChatStreamRequest = {
  messages: LlmMessage[]
  temperature: number
  maxTokens: number
  user: string
  signal: AbortSignal
}

export type ChatStreamChunk =
  | { type: 'delta'; text: string }
  | { type: 'end'; finishReason: string | null; refusal: string | null; usage: TokenUsage | null }

export interface LlmGateway {
  readonly model: string
  completeJson(request: JsonCompletionRequest): Promise<CompletionResult>
  streamChat(request: ChatStreamRequest): AsyncGenerator<ChatStreamChunk>
}

const liveGateway: LlmGateway = {
  get model() {
    return getLlmModel()
  },

  async completeJson(request) {
    const response = await getOpenAI().chat.completions.create(
      {
        model: getLlmModel(),
        messages: request.messages,
        response_format: request.responseFormat,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        user: request.user,
      },
      { timeout: request.timeoutMs },
    )
    const choice = response.choices[0]
    return {
      content: choice?.message?.content ?? null,
      refusal: choice?.message?.refusal ?? null,
      finishReason: choice?.finish_reason ?? null,
      usage: response.usage ?? null,
    }
  },

  async *streamChat(request) {
    const stream = await getOpenAI().chat.completions.create(
      {
        model: getLlmModel(),
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        user: request.user,
        stream: true,
        stream_options: { include_usage: true },
      },
      { signal: request.signal },
    )

    let finishReason: string | null = null
    let refusal = ''
    let usage: TokenUsage | null = null
    for await (const chunk of stream) {
      const choice = chunk.choices[0]
      if (choice?.delta?.content) yield { type: 'delta', text: choice.delta.content }
      if (choice?.delta?.refusal) refusal += choice.delta.refusal
      if (choice?.finish_reason) finishReason = choice.finish_reason
      if (chunk.usage) usage = chunk.usage
    }
    yield { type: 'end', finishReason, refusal: refusal || null, usage }
  },
}

/** Live OpenAI gateway, or the deterministic fixture gateway when LLM_MODE=fixture (E2E tests). */
export function getLlmGateway(): LlmGateway {
  return getEnv().LLM_MODE === 'fixture' ? fixtureGateway : liveGateway
}
