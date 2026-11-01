import OpenAI from 'openai'
import { describe, expect, it } from 'vitest'
import { AppError } from '@/lib/api/errors'
import { describeAzureError, parseAgentEndpoint } from '@/lib/azure'
import { extractJsonObject, toChatInput, toCompletionResult, toJsonInput } from '@/lib/llm/gateway'

describe('parseAgentEndpoint', () => {
  it('maps a project endpoint to its /openai/v1 Responses route', () => {
    expect(parseAgentEndpoint('https://acme.services.ai.azure.com/api/projects/p1')).toEqual({
      kind: 'project',
      baseURL: 'https://acme.services.ai.azure.com/api/projects/p1/openai/v1',
    })
    expect(parseAgentEndpoint('https://acme.services.ai.azure.com/api/projects/p1/openai/v1/').baseURL).toBe(
      'https://acme.services.ai.azure.com/api/projects/p1/openai/v1',
    )
  })

  it('strips the trailing /responses from an application endpoint and keeps any api-version', () => {
    expect(
      parseAgentEndpoint('https://acme.services.ai.azure.com/api/projects/p1/applications/a1/protocols/openai/responses?api-version=2025-11-15-preview'),
    ).toEqual({
      kind: 'application',
      baseURL: 'https://acme.services.ai.azure.com/api/projects/p1/applications/a1/protocols/openai',
      apiVersion: '2025-11-15-preview',
    })
  })
})

describe('agent input bundling', () => {
  it('puts rules, contract, history and the question into one message', () => {
    const input = toChatInput([
      { role: 'system', content: 'RULES' },
      { role: 'system', content: '<contract>text</contract>' },
      { role: 'user', content: 'Q1' },
      { role: 'assistant', content: 'A1' },
      { role: 'user', content: 'Q2' },
    ])
    expect(input).toMatch(/RULES[\s\S]*<contract>text<\/contract>[\s\S]*User: Q1\n\nAssistant: A1[\s\S]*<question>\nQ2\n<\/question>$/)
  })

  it('appends the JSON schema to extraction input', () => {
    expect(toJsonInput([{ role: 'user', content: 'DATA' }], { type: 'object' })).toContain('{"type":"object"}')
  })

  it('extracts JSON from fenced or chatty replies', () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toBe('{"a":1}')
    expect(extractJsonObject('Here you go: {"a":{"b":2}} thanks')).toBe('{"a":{"b":2}}')
  })
})

describe('toCompletionResult', () => {
  it('maps Responses output, status and usage', () => {
    expect(
      toCompletionResult({
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Hi' }] }],
        usage: { input_tokens: 10, output_tokens: 2, input_tokens_details: { cached_tokens: 4 } },
      }),
    ).toEqual({
      content: 'Hi',
      refusal: null,
      finishReason: 'stop',
      usage: { prompt_tokens: 10, completion_tokens: 2, prompt_tokens_details: { cached_tokens: 4 } },
    })
    expect(toCompletionResult({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }).finishReason).toBe('length')
  })
})

describe('describeAzureError', () => {
  it('surfaces the upstream status and message through AppError causes', () => {
    const upstream = OpenAI.APIError.generate(405, { message: 'Method Not Allowed' }, undefined, new Headers())
    expect(describeAzureError(new AppError('LLM_UNAVAILABLE', undefined, { cause: upstream }))).toContain('405')
    expect(describeAzureError(new Error('other'))).toBeUndefined()
  })
})

describe('agentEndpointProblem', () => {
  it('accepts project and application endpoints, rejects OpenAI-resource and malformed URLs', async () => {
    const { agentEndpointProblem } = await import('@/lib/azure')
    expect(agentEndpointProblem('https://x.services.ai.azure.com/api/projects/p')).toBeNull()
    expect(agentEndpointProblem('https://x.services.ai.azure.com/api/projects/p/applications/a/protocols/openai/responses')).toBeNull()
    expect(agentEndpointProblem('https://x.openai.azure.com/openai/responses')).toContain('openai.azure.com')
    expect(agentEndpointProblem('https://x.services.ai.azure.com/models')).toContain('/api/projects/')
    expect(agentEndpointProblem('nope')).toContain('not a valid URL')
  })
})
