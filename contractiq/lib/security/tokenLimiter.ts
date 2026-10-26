import { AppError } from '@/lib/api/errors'
import {
  MAX_CHAT_INPUT_CHARS,
  MAX_CHAT_MESSAGES,
  MAX_CONTRACT_TOKENS,
  MAX_FILE_SIZE_BYTES,
  MAX_PAGES,
} from '@/lib/constants/limits'
import { countTokens } from '@/lib/llm/tokens'

/**
 * Size / usage limits that bound storage and OpenAI cost. Values follow the PRD where it is stricter
 * than the security baseline (20 pages, 2,000-character messages); see docs/security/security-plan.md.
 */
export const TOKEN_LIMITS = {
  maxFileSizeBytes: MAX_FILE_SIZE_BYTES, // 10 MB — matches the storage bucket limit
  maxPageCount: MAX_PAGES, // 20 pages (PRD FR-02)
  maxMessageLength: MAX_CHAT_INPUT_CHARS, // 2,000 characters
  maxContractTokens: MAX_CONTRACT_TOKENS, // 15,000 tokens
  defaultChatHistory: 100,
} as const

/** Messages of history sent to the model per chat turn (env MAX_CHAT_HISTORY, default 100, max 198). */
export function getMaxChatHistory(env: Record<string, string | undefined> = process.env): number {
  const raw = env.MAX_CHAT_HISTORY?.trim()
  const parsed = raw ? Number(raw) : Number.NaN
  if (!Number.isInteger(parsed) || parsed < 0) return TOKEN_LIMITS.defaultChatHistory
  return Math.min(parsed, MAX_CHAT_MESSAGES - 2)
}

export function assertFileSize(bytes: number): void {
  if (bytes <= 0) throw new AppError('INVALID_PDF')
  if (bytes > TOKEN_LIMITS.maxFileSizeBytes) throw new AppError('FILE_TOO_LARGE')
}

export function assertPageCount(pages: number): void {
  if (pages > TOKEN_LIMITS.maxPageCount) throw new AppError('TOO_MANY_PAGES')
}

export function assertMessageLength(text: string): void {
  if (text.length > TOKEN_LIMITS.maxMessageLength) {
    throw new AppError('VALIDATION_ERROR', `Use ${TOKEN_LIMITS.maxMessageLength.toLocaleString('en-US')} characters or fewer.`, {
      fields: { message: `Use ${TOKEN_LIMITS.maxMessageLength.toLocaleString('en-US')} characters or fewer` },
    })
  }
}

/** Re-counts tokens on the stored text right before an LLM call (never trust a stored count). */
export function assertContractTokens(contractText: string): number {
  const tokens = countTokens(contractText)
  if (tokens > TOKEN_LIMITS.maxContractTokens) throw new AppError('TOO_LONG')
  return tokens
}
