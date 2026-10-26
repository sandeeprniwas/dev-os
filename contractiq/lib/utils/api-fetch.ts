import type { ErrorCode } from '@/lib/api/errors'
import type { ApiErrorPayload } from '@/types/api'

const NETWORK_ERROR_MESSAGE = "We couldn't reach the server. Check your connection and try again."

/** Error thrown by apiFetch for any non-2xx response or network failure. */
export class ApiClientError extends Error {
  readonly code: ErrorCode | 'NETWORK_ERROR'
  readonly status: number
  readonly requestId?: string
  readonly fields?: Record<string, string>
  readonly retryAfterSeconds?: number

  constructor(init: {
    code: ApiClientError['code']
    message: string
    status: number
    requestId?: string
    fields?: Record<string, string>
    retryAfterSeconds?: number
  }) {
    super(init.message)
    this.name = 'ApiClientError'
    this.code = init.code
    this.status = init.status
    this.requestId = init.requestId
    this.fields = init.fields
    this.retryAfterSeconds = init.retryAfterSeconds
  }
}

type ApiFetchOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  /** Redirect to /login on 401 (default true). */
  redirectOnUnauthenticated?: boolean
}

/**
 * Same-origin JSON fetch for client components. Plain objects are sent as JSON; FormData as-is.
 * Throws ApiClientError on non-2xx. Use apiRequest() to get the raw Response (streaming endpoints).
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const response = await apiRequest(path, options)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export async function apiRequest(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const { body, redirectOnUnauthenticated = true, headers, ...init } = options
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData

  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && !isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
    })
  } catch {
    throw new ApiClientError({ code: 'NETWORK_ERROR', message: NETWORK_ERROR_MESSAGE, status: 0 })
  }

  if (response.ok) return response

  const error = await toApiClientError(response)
  if (error.status === 401 && redirectOnUnauthenticated && typeof window !== 'undefined') {
    const redirectTo = encodeURIComponent(window.location.pathname + window.location.search)
    window.location.assign(`/login?redirectTo=${redirectTo}`)
  }
  throw error
}

export async function toApiClientError(response: Response): Promise<ApiClientError> {
  const retryAfter = Number(response.headers.get('Retry-After'))
  let payload: ApiErrorPayload | undefined
  try {
    payload = ((await response.json()) as { error?: ApiErrorPayload }).error
  } catch {
    payload = undefined
  }

  return new ApiClientError({
    code: payload?.code ?? 'INTERNAL_ERROR',
    message: payload?.message ?? 'Something went wrong. Try again.',
    status: response.status,
    requestId: payload?.requestId,
    fields: payload?.fields,
    retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
  })
}
