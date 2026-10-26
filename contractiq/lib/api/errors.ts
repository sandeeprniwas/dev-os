import type { PostgrestError } from '@supabase/supabase-js'

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'PROMPT_INJECTION'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_CONFIRMED'
  | 'FORBIDDEN_ORIGIN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'ALREADY_PROCESSING'
  | 'RATE_LIMITED'
  | 'FILE_TOO_LARGE'
  | 'INVALID_PDF'
  | 'TOO_MANY_PAGES'
  | 'SCANNED_PDF'
  | 'TOO_LONG'
  | 'CHAT_LIMIT_REACHED'
  | 'LLM_UNAVAILABLE'
  | 'LLM_REFUSED'
  | 'LLM_INVALID_OUTPUT'
  | 'TIMEOUT'
  | 'INTERNAL_ERROR'

/** Single source of truth for status codes and user-facing copy (foundation spec §7.1). */
export const ERROR_DEFINITIONS: Record<ErrorCode, { status: number; message: string }> = {
  VALIDATION_ERROR: { status: 422, message: 'Please check the highlighted fields.' },
  PROMPT_INJECTION: {
    status: 400,
    message: "That message looks like an attempt to change how the assistant works, so it wasn't sent. Please rephrase it as a question about the contract.",
  },
  UNAUTHENTICATED: { status: 401, message: 'Please sign in to continue.' },
  INVALID_CREDENTIALS: { status: 401, message: 'Email or password is incorrect.' },
  EMAIL_NOT_CONFIRMED: { status: 403, message: 'Please verify your email first.' },
  FORBIDDEN_ORIGIN: { status: 403, message: 'Request blocked.' },
  NOT_FOUND: { status: 404, message: "We couldn't find that contract." },
  CONFLICT: { status: 409, message: "This contract can't be changed right now." },
  ALREADY_PROCESSING: { status: 409, message: 'This contract is already being processed.' },
  RATE_LIMITED: { status: 429, message: "You're doing that too often. Try again in a few minutes." },
  FILE_TOO_LARGE: { status: 413, message: 'This file is larger than 10 MB.' },
  INVALID_PDF: { status: 422, message: "We couldn't read this PDF. It may be corrupted or password-protected." },
  TOO_MANY_PAGES: { status: 422, message: 'ContractIQ supports contracts up to 20 pages.' },
  SCANNED_PDF: {
    status: 422,
    message: 'Scanned PDFs are not supported yet. Please upload a PDF with selectable text.',
  },
  TOO_LONG: {
    status: 422,
    message: 'This contract is longer than we support today (15,000 tokens). Longer contract support is coming.',
  },
  CHAT_LIMIT_REACHED: { status: 409, message: 'This conversation has reached its limit.' },
  LLM_UNAVAILABLE: { status: 503, message: 'Our AI service is busy. Try again in a few minutes.' },
  LLM_REFUSED: { status: 422, message: "We couldn't analyse this document. Please check it is an NDA or MSA." },
  LLM_INVALID_OUTPUT: { status: 502, message: 'Something went wrong while analysing. Try again.' },
  TIMEOUT: { status: 504, message: 'Processing took too long. Try again.' },
  INTERNAL_ERROR: { status: 500, message: 'Something went wrong. Try again.' },
}

export type ErrorDetails = {
  fields?: Record<string, string>
  retryAfterSeconds?: number
  cause?: unknown
}

export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly details: ErrorDetails

  constructor(code: ErrorCode, message?: string, details: ErrorDetails = {}) {
    super(message ?? ERROR_DEFINITIONS[code].message)
    this.name = 'AppError'
    this.code = code
    this.status = ERROR_DEFINITIONS[code].status
    this.details = details
  }
}

export function rateLimitMessage(retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60))
  return `You're doing that too often. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
}

/** Maps database errors raised by our SQL functions, triggers and constraints (database spec §4). */
export function fromPostgrestError(error: PostgrestError): AppError {
  const text = `${error.message} ${error.details ?? ''}`
  switch (error.code) {
    case 'P0001':
      if (text.includes('custom_term_limit_exceeded')) {
        return new AppError('VALIDATION_ERROR', 'Up to 5 custom terms.', { fields: { terms: 'Up to 5 custom terms' } })
      }
      return new AppError('VALIDATION_ERROR', undefined, { cause: error })
    case 'P0002':
    case 'PGRST116': // .single() found no row
      return new AppError('NOT_FOUND', undefined, { cause: error })
    case '23505':
      return new AppError('VALIDATION_ERROR', 'That entry already exists.', { cause: error })
    case '23514':
    case '22001':
      return new AppError('VALIDATION_ERROR', undefined, { cause: error })
    case '42501':
      return new AppError('UNAUTHENTICATED', undefined, { cause: error })
    default:
      return new AppError('INTERNAL_ERROR', undefined, { cause: error })
  }
}

export type ApiErrorBody = {
  error: { code: ErrorCode; message: string; requestId: string; fields?: Record<string, string> }
}
