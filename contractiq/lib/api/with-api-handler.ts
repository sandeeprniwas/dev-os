import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'
import { logger } from '@/lib/utils/logger'
import { checkOrigin } from './check-origin'
import { AppError, ERROR_DEFINITIONS, type ApiErrorBody } from './errors'

export type HandlerContext<P> = { params: P; requestId: string }
type RouteHandler<P> = (request: NextRequest, context: HandlerContext<P>) => Promise<Response>

/**
 * Wraps every API route: request id, origin check, error envelope, one log line per request.
 */
export function withApiHandler<P = Record<string, never>>(handler: RouteHandler<P>) {
  return async (request: NextRequest, context: { params: P }): Promise<Response> => {
    const requestId = crypto.randomUUID()
    const startedAt = Date.now()
    const route = request.nextUrl.pathname

    let response: Response
    try {
      checkOrigin(request)
      response = await handler(request, { params: context.params, requestId })
    } catch (error) {
      response = toErrorResponse(error, requestId, { method: request.method, route })
    }

    response.headers.set('x-request-id', requestId)
    logger.info('api_request', {
      requestId,
      method: request.method,
      route,
      status: response.status,
      ms: Date.now() - startedAt,
    })
    return response
  }
}

export function toErrorResponse(
  error: unknown,
  requestId: string,
  meta: { method: string; route: string },
): NextResponse<ApiErrorBody> {
  const appError = normaliseError(error)

  if (appError.status >= 500) {
    logger.error('api_error', { requestId, ...meta, code: appError.code, cause: appError.details.cause ?? error })
  }

  const body: ApiErrorBody = {
    error: {
      code: appError.code,
      message: appError.message,
      requestId,
      ...(appError.details.fields ? { fields: appError.details.fields } : {}),
    },
  }

  const headers = new Headers()
  if (appError.details.retryAfterSeconds !== undefined) {
    headers.set('Retry-After', String(appError.details.retryAfterSeconds))
  }
  return NextResponse.json(body, { status: appError.status, headers })
}

export function normaliseError(error: unknown): AppError {
  if (error instanceof AppError) return error
  if (error instanceof ZodError) {
    const fields: Record<string, string> = {}
    for (const issue of error.issues) {
      const key = issue.path.join('.') || 'body'
      fields[key] ??= issue.message
    }
    return new AppError('VALIDATION_ERROR', ERROR_DEFINITIONS.VALIDATION_ERROR.message, { fields })
  }
  return new AppError('INTERNAL_ERROR', undefined, { cause: error })
}
