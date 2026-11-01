import 'server-only'
import OpenAI from 'openai'
import { LLM_TIMEOUT_MS } from '@/lib/constants/limits'
import { getEnv } from '@/lib/env'

/*
 * Azure AI Foundry agent client. Agents speak the OpenAI Responses API, so we reuse the `openai` SDK.
 * The agent owns its model, instructions and tools in the Foundry portal. Two endpoint styles:
 *
 *  - Project endpoint (current portal, "View endpoint"): …services.ai.azure.com/api/projects/<project>
 *    → POST <project>/openai/v1/responses with `agent_reference: { name: AZURE_AGENT_NAME }`.
 *  - Published agent application endpoint: …/applications/<app>/protocols/openai/responses
 *    → POST to it directly with an api-version; the application already pins the agent.
 */

// Confirmed in the Foundry "Agent applications" docs (Responses protocol examples). Only used for
// application endpoints; the project /openai/v1 route is unversioned.
export const DEFAULT_AZURE_API_VERSION = '2025-11-15-preview'

/** Label stored in llm_usage / contracts.model — the real model is configured on the agent. */
export const AZURE_AGENT_MODEL_LABEL = 'azure-ai-foundry-agent'

export type AgentReference = { type: 'agent_reference'; name: string }
export type AzureAgent = { client: OpenAI; agentReference: AgentReference | null }

let agent: AzureAgent | null = null

export type AgentEndpoint =
  | { kind: 'project'; baseURL: string }
  | { kind: 'application'; baseURL: string; apiVersion: string | null }

/**
 * Turns the portal endpoint into the SDK base URL. The SDK appends `/responses` itself, so a trailing
 * `/responses` is stripped (leaving it on doubles the path and Azure returns 405).
 */
export function parseAgentEndpoint(endpoint: string): AgentEndpoint {
  const url = new URL(endpoint.trim())
  const path = url.pathname.replace(/\/+$/, '')
  if (/\/responses$/.test(path)) {
    return { kind: 'application', baseURL: `${url.origin}${path.replace(/\/responses$/, '')}`, apiVersion: url.searchParams.get('api-version') }
  }
  return { kind: 'project', baseURL: `${url.origin}${path.replace(/\/openai(\/v1)?$/, '')}/openai/v1` }
}

/** Why an endpoint can't be used, or null when it looks right. */
export function agentEndpointProblem(endpoint: string): string | null {
  let url: URL
  try {
    url = new URL(endpoint.trim())
  } catch {
    return 'is not a valid URL.'
  }
  if (!url.hostname.endsWith('services.ai.azure.com')) {
    return 'must be the Foundry endpoint on services.ai.azure.com, not an Azure OpenAI (openai.azure.com) URL.'
  }
  if (!/\/api\/projects\/[^/]+/.test(url.pathname)) {
    return 'must include /api/projects/<project-name> (copy it from Foundry → your agent → View endpoint).'
  }
  return null
}

/** Server-only singleton. SDK retries are disabled; withRetry() owns retry policy. */
export function getAzureAgent(): AzureAgent {
  if (agent) return agent

  const env = getEnv()
  const apiKey = env.AZURE_API_KEY
  const endpoint = env.AZURE_AGENT_ENDPOINT
  if (!apiKey || !endpoint) {
    throw new Error('AZURE_API_KEY and AZURE_AGENT_ENDPOINT must be set in .env.local')
  }
  const problem = agentEndpointProblem(endpoint)
  if (problem) throw new Error(`AZURE_AGENT_ENDPOINT ${problem}`)

  const parsed = parseAgentEndpoint(endpoint)
  if (parsed.kind === 'project' && !env.AZURE_AGENT_NAME) {
    throw new Error('AZURE_AGENT_NAME must be set in .env.local when AZURE_AGENT_ENDPOINT is a project endpoint')
  }

  const apiVersion = parsed.kind === 'application' ? (env.AZURE_API_VERSION ?? parsed.apiVersion ?? DEFAULT_AZURE_API_VERSION) : env.AZURE_API_VERSION
  const client = new OpenAI({
    apiKey,
    baseURL: parsed.baseURL,
    // Azure requires the key in its own header as well as the standard Authorization header.
    defaultHeaders: { 'api-key': apiKey },
    ...(apiVersion ? { defaultQuery: { 'api-version': apiVersion } } : {}),
    maxRetries: 0,
    timeout: LLM_TIMEOUT_MS,
  })

  agent = {
    client,
    agentReference: parsed.kind === 'project' ? { type: 'agent_reference', name: env.AZURE_AGENT_NAME! } : null,
  }
  return agent
}

/**
 * The real upstream error text (status + Azure's message), so endpoint / key / api-version problems
 * can be diagnosed from the response. Unwraps AppError causes. Never includes the API key.
 */
export function describeAzureError(error: unknown): string | undefined {
  let current: unknown = error
  for (let depth = 0; depth < 4 && current; depth++) {
    if (current instanceof OpenAI.APIError) {
      return current.status ? `HTTP ${current.status}: ${current.message}` : current.message
    }
    if (current instanceof Error && current.message.startsWith('AZURE_')) return current.message
    const cause = (current as { details?: { cause?: unknown }; cause?: unknown }).details?.cause ?? (current as { cause?: unknown }).cause
    current = cause
  }
  return undefined
}
