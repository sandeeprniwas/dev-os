import 'server-only'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { AZURE_AGENT_MODEL_LABEL, getAzureAgent } from '@/lib/azure'
import { getEnv } from '@/lib/env'
import type { TokenUsage } from './cost'
import { fixtureGateway } from './fixture-gateway'

/** Prompt builders still produce role-tagged messages; the gateway bundles them into one agent input. */
export type LlmMessage = ChatCompletionMessageParam

export type JsonCompletionRequest = {
  messages: LlmMessage[]
  /** JSON Schema the answer must match. Sent as text — the agent rejects response-format overrides. */
  jsonSchema: Record<string, unknown>
  timeoutMs: number
  /** Hashed app user id: scopes the agent's Memory tool ({{$userId}}) to this user. */
  memoryUserId: string
}

export type ChatCompletionRequest = {
  messages: LlmMessage[]
  signal: AbortSignal
  /** Hashed app user id: scopes the agent's Memory tool ({{$userId}}) to this user. */
  memoryUserId: string
}

export type CompletionResult = {
  content: string | null
  refusal: string | null
  finishReason: string | null
  usage: TokenUsage | null
}

export interface LlmGateway {
  readonly model: string
  completeJson(request: JsonCompletionRequest): Promise<CompletionResult>
  completeChat(request: ChatCompletionRequest): Promise<CompletionResult>
}

const PREFACE = 'Follow the task instructions below for this request.'

const text = (message: LlmMessage): string => (typeof message.content === 'string' ? message.content : '')

/**
 * Chat: task rules + contract first, earlier turns as a transcript, then the question to answer.
 * Everything goes into ONE user message — the agent has its own system prompt in the Foundry portal.
 */
export function toChatInput(messages: LlmMessage[]): string {
  const system = messages.filter((m) => m.role === 'system').map(text)
  const turns = messages.filter((m) => m.role === 'user' || m.role === 'assistant')
  const question = turns.at(-1)
  const history = turns.slice(0, -1)

  const parts = [PREFACE, ...system]
  if (history.length > 0) {
    const transcript = history.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${text(m)}`).join('\n\n')
    parts.push(`<conversation_history>\n${transcript}\n</conversation_history>`)
  }
  parts.push(`<question>\n${question ? text(question) : ''}\n</question>`)
  return parts.join('\n\n')
}

/** Extraction: instructions, examples and data in order; a previous bad reply (repair) is labelled as such. */
export function toJsonInput(messages: LlmMessage[], jsonSchema: Record<string, unknown>): string {
  const parts = [PREFACE]
  for (const message of messages) {
    parts.push(message.role === 'assistant' ? `<previous_response>\n${text(message)}\n</previous_response>` : text(message))
  }
  parts.push(
    'OUTPUT FORMAT\nReturn ONLY one JSON object that matches this JSON Schema. No markdown, no code fences, no commentary.\n' +
      JSON.stringify(jsonSchema),
  )
  return parts.join('\n\n')
}

/** Pulls the JSON object out of a reply that may be wrapped in ``` fences or stray prose. */
export function extractJsonObject(reply: string): string {
  const unfenced = reply.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
  const start = unfenced.indexOf('{')
  const end = unfenced.lastIndexOf('}')
  return start !== -1 && end > start ? unfenced.slice(start, end + 1) : unfenced.trim()
}

type AgentResponse = {
  status?: string
  incomplete_details?: { reason?: string } | null
  output?: { type?: string; content?: { type?: string; text?: string; refusal?: string }[] }[]
  output_text?: string
  usage?: { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } } | null
}

/** Normalises a Responses API result to the shape the services already understand. */
export function toCompletionResult(response: AgentResponse): CompletionResult {
  let content = ''
  let refusal = ''
  for (const item of response.output ?? []) {
    if (item.type !== 'message') continue
    for (const part of item.content ?? []) {
      if (part.type === 'output_text' && part.text) content += part.text
      if (part.type === 'refusal' && part.refusal) refusal += part.refusal
    }
  }
  if (!content && response.output_text) content = response.output_text

  const reason = response.incomplete_details?.reason
  const finishReason =
    response.status === 'incomplete' ? (reason === 'max_output_tokens' ? 'length' : (reason ?? 'incomplete')) : 'stop'

  const usage = response.usage
    ? {
        prompt_tokens: response.usage.input_tokens ?? 0,
        completion_tokens: response.usage.output_tokens ?? 0,
        prompt_tokens_details: { cached_tokens: response.usage.input_tokens_details?.cached_tokens ?? 0 },
      }
    : null

  return { content: content || null, refusal: refusal || null, finishReason, usage }
}

/**
 * Calls the Azure agent. Only `input` (plus the agent reference for project endpoints) is sent: the
 * agent rejects `model`, `instructions` and other overrides. The SDK types require `model`, so
 * `responses` is cast to `any` (no runtime effect).
 */
async function callAgent(
  input: string,
  memoryUserId: string,
  options: { timeout?: number; signal?: AbortSignal },
): Promise<CompletionResult> {
  const { client, agentReference } = getAzureAgent()
  const responses = client.responses as any
  const body = { input: [{ role: 'user', content: input }], ...(agentReference ? { agent_reference: agentReference } : {}) }
  // With an API key there is no signed-in Azure user, so the Memory tool's {{$userId}} scope comes from this header.
  const headers = { 'x-memory-user-id': memoryUserId }
  const response = (await responses.create(body, { ...options, headers })) as AgentResponse
  return toCompletionResult(response)
}

const azureGateway: LlmGateway = {
  model: AZURE_AGENT_MODEL_LABEL,

  async completeJson(request) {
    const result = await callAgent(toJsonInput(request.messages, request.jsonSchema), request.memoryUserId, { timeout: request.timeoutMs })
    return { ...result, content: result.content === null ? null : extractJsonObject(result.content) }
  },

  async completeChat(request) {
    return callAgent(toChatInput(request.messages), request.memoryUserId, { signal: request.signal })
  },
}

/** Azure AI Foundry agent gateway, or the deterministic fixture gateway when LLM_MODE=fixture (E2E tests). */
export function getLlmGateway(): LlmGateway {
  return getEnv().LLM_MODE === 'fixture' ? fixtureGateway : azureGateway
}
