import 'server-only'
import OpenAI from 'openai'
import { LLM_TIMEOUT_MS } from '@/lib/constants/limits'
import { getEnv } from '@/lib/env'
import { sha256Hex } from '@/lib/utils/hash'

let openaiClient: OpenAI | null = null

/** Server-only OpenAI client. SDK retries are disabled; withRetry() owns retry policy. */
export function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: getEnv().OPENAI_API_KEY, maxRetries: 0, timeout: LLM_TIMEOUT_MS })
  }
  return openaiClient
}

export function getLlmModel(): string {
  return getEnv().OPENAI_MODEL
}

/** Opaque, salted user identifier for OpenAI's `user` parameter (no PII leaves the server). */
export function hashUserId(userId: string): string {
  return sha256Hex(getEnv().USER_ID_HASH_SALT + userId)
}
