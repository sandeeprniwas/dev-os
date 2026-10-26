import type { NextRequest } from 'next/server'
import { AppError } from './errors'

const MAX_JSON_BYTES = 64 * 1024

/** Parses a JSON request body (≤ 64 KB). Invalid or oversized bodies become 400 VALIDATION_ERROR. */
export async function readJson(request: NextRequest): Promise<unknown> {
  const length = Number(request.headers.get('content-length') ?? 0)
  if (length > MAX_JSON_BYTES) throw new AppError('VALIDATION_ERROR', 'Request body is too large.')

  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new AppError('VALIDATION_ERROR', 'Send the request body as JSON.')
  }

  const text = await request.text()
  if (text.length > MAX_JSON_BYTES) throw new AppError('VALIDATION_ERROR', 'Request body is too large.')
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    throw new AppError('VALIDATION_ERROR', 'Request body is not valid JSON.')
  }
}
