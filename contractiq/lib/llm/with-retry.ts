import OpenAI from 'openai'
import { AppError } from '@/lib/api/errors'
import { logger } from '@/lib/utils/logger'

/** Thrown by callers for retryable model outcomes, e.g. finish_reason === 'length'. */
export class RetryableLLMError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RetryableLLMError'
  }
}

export type RetryOptions = {
  deadline: number // epoch ms by which the whole operation must finish
  attempts?: number
  backoffMs?: number[]
  minRemainingMs?: number
  sleep?: (ms: number) => Promise<void>
}

export function isRetryableLlmError(error: unknown): boolean {
  return (
    error instanceof RetryableLLMError ||
    error instanceof OpenAI.RateLimitError ||
    error instanceof OpenAI.InternalServerError ||
    error instanceof OpenAI.APIConnectionTimeoutError ||
    error instanceof OpenAI.APIConnectionError
  )
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Runs `fn` with exponential backoff, retrying only transient OpenAI failures, and never
 * starting a retry that could not finish before `deadline`.
 * Non-retryable failures and exhausted retries become LLM_UNAVAILABLE; AppErrors pass through.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions,
): Promise<{ result: T; attempts: number }> {
  const { deadline, attempts = 3, backoffMs = [500, 1500], minRemainingMs = 8000, sleep = defaultSleep } = options

  for (let attempt = 1; ; attempt++) {
    try {
      return { result: await fn(attempt), attempts: attempt }
    } catch (error) {
      if (error instanceof AppError) throw error

      if (error instanceof OpenAI.AuthenticationError) {
        logger.error('openai_authentication_failed', { attempt })
        throw new AppError('LLM_UNAVAILABLE', undefined, { cause: error })
      }

      const delay = backoffMs[Math.min(attempt - 1, backoffMs.length - 1)] ?? 0
      const remaining = deadline - Date.now() - delay
      const canRetry = isRetryableLlmError(error) && attempt < attempts && remaining >= minRemainingMs

      logger.warn('llm_call_failed', {
        attempt,
        retrying: canRetry,
        errorName: error instanceof Error ? error.name : typeof error,
        status: error instanceof OpenAI.APIError ? error.status : undefined,
      })

      if (!canRetry) {
        throw new AppError('LLM_UNAVAILABLE', undefined, { cause: error })
      }
      await sleep(delay)
    }
  }
}
