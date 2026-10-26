import type { PostgrestError } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { AppError, ERROR_DEFINITIONS, fromPostgrestError, rateLimitMessage } from '@/lib/api/errors'
import { normaliseError, toErrorResponse } from '@/lib/api/with-api-handler'

const pgError = (code: string, message = 'boom'): PostgrestError =>
  ({ code, message, details: '', hint: '', name: 'PostgrestError' }) as PostgrestError

describe('AppError', () => {
  it('uses the status and default copy from ERROR_DEFINITIONS', () => {
    const error = new AppError('SCANNED_PDF')
    expect(error.status).toBe(422)
    expect(error.message).toBe(ERROR_DEFINITIONS.SCANNED_PDF.message)
  })

  it('accepts a custom message', () => {
    expect(new AppError('NOT_FOUND', 'Gone').message).toBe('Gone')
  })
})

describe('rateLimitMessage', () => {
  it.each([
    [30, 'Try again in 1 minute.'],
    [60, 'Try again in 1 minute.'],
    [61, 'Try again in 2 minutes.'],
    [3599, 'Try again in 60 minutes.'],
  ])('%i seconds → %s', (seconds, suffix) => {
    expect(rateLimitMessage(seconds)).toContain(suffix)
  })
})

describe('fromPostgrestError', () => {
  it('maps the custom-term trigger to a validation error', () => {
    const error = fromPostgrestError(pgError('P0001', 'custom_term_limit_exceeded'))
    expect(error.code).toBe('VALIDATION_ERROR')
    expect(error.details.fields).toEqual({ terms: 'Up to 5 custom terms' })
  })

  it.each([
    ['P0002', 'NOT_FOUND'],
    ['PGRST116', 'NOT_FOUND'],
    ['23505', 'VALIDATION_ERROR'],
    ['23514', 'VALIDATION_ERROR'],
    ['42501', 'UNAUTHENTICATED'],
    ['XX000', 'INTERNAL_ERROR'],
  ])('%s → %s', (code, expected) => {
    expect(fromPostgrestError(pgError(code)).code).toBe(expected)
  })
})

describe('normaliseError / toErrorResponse', () => {
  it('turns a ZodError into a 422 VALIDATION_ERROR with per-field messages', () => {
    const result = z.object({ email: z.email('Enter a valid email address') }).safeParse({ email: 'nope' })
    const error = normaliseError(result.error)
    expect(error.code).toBe('VALIDATION_ERROR')
    expect(error.status).toBe(422)
    expect(error.details.fields).toEqual({ email: 'Enter a valid email address' })
  })

  it('hides unknown errors behind INTERNAL_ERROR', async () => {
    const response = toErrorResponse(new Error('db password leaked in message'), 'req-1', { method: 'GET', route: '/x' })
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toEqual({ code: 'INTERNAL_ERROR', message: 'Something went wrong. Try again.', requestId: 'req-1' })
  })

  it('sets Retry-After for rate-limit errors', () => {
    const response = toErrorResponse(new AppError('RATE_LIMITED', 'slow down', { retryAfterSeconds: 42 }), 'req-2', {
      method: 'POST',
      route: '/x',
    })
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('42')
  })
})
