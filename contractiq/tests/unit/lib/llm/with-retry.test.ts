import OpenAI from 'openai'
import { describe, expect, it, vi } from 'vitest'
import { AppError } from '@/lib/api/errors'
import { RetryableLLMError, withRetry } from '@/lib/llm/with-retry'

const noSleep = () => Promise.resolve()
const farDeadline = () => Date.now() + 60_000

const rateLimit = () => new OpenAI.RateLimitError(429, { message: 'slow down' }, 'slow down', new Headers())
const badRequest = () => new OpenAI.BadRequestError(400, { message: 'bad' }, 'bad', new Headers())
const authError = () => new OpenAI.AuthenticationError(401, { message: 'bad key' }, 'bad key', new Headers())

describe('withRetry', () => {
  it('returns the result and attempt count on success', async () => {
    const result = await withRetry(async () => 'ok', { deadline: farDeadline(), sleep: noSleep })
    expect(result).toEqual({ result: 'ok', attempts: 1 })
  })

  it('retries 429s and succeeds on a later attempt', async () => {
    const fn = vi.fn().mockRejectedValueOnce(rateLimit()).mockResolvedValueOnce('ok')
    const result = await withRetry(fn, { deadline: farDeadline(), sleep: noSleep })
    expect(result.attempts).toBe(2)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('gives up after 3 attempts with LLM_UNAVAILABLE', async () => {
    const fn = vi.fn().mockRejectedValue(rateLimit())
    await expect(withRetry(fn, { deadline: farDeadline(), sleep: noSleep })).rejects.toMatchObject({
      code: 'LLM_UNAVAILABLE',
    })
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('does not retry a 400', async () => {
    const fn = vi.fn().mockRejectedValue(badRequest())
    await expect(withRetry(fn, { deadline: farDeadline(), sleep: noSleep })).rejects.toBeInstanceOf(AppError)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('does not retry an authentication failure', async () => {
    const fn = vi.fn().mockRejectedValue(authError())
    await expect(withRetry(fn, { deadline: farDeadline(), sleep: noSleep })).rejects.toMatchObject({
      code: 'LLM_UNAVAILABLE',
    })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries RetryableLLMError (e.g. truncated output)', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new RetryableLLMError('length')).mockResolvedValueOnce('ok')
    await expect(withRetry(fn, { deadline: farDeadline(), sleep: noSleep })).resolves.toMatchObject({ attempts: 2 })
  })

  it('does not start a retry when less than minRemainingMs is left', async () => {
    const fn = vi.fn().mockRejectedValue(rateLimit())
    await expect(
      withRetry(fn, { deadline: Date.now() + 5_000, minRemainingMs: 8_000, sleep: noSleep }),
    ).rejects.toMatchObject({ code: 'LLM_UNAVAILABLE' })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('passes AppErrors through unchanged', async () => {
    const refused = new AppError('LLM_REFUSED')
    await expect(withRetry(() => Promise.reject(refused), { deadline: farDeadline(), sleep: noSleep })).rejects.toBe(
      refused,
    )
  })
})
