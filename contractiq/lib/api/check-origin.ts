import type { NextRequest } from 'next/server'
import { publicEnv } from '@/lib/public-env'
import { AppError } from './errors'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * CSRF defence for cookie-authenticated mutations (security SEC-15).
 * Requests without an Origin header (server-to-server, curl) are allowed; auth still applies.
 */
export function checkOrigin(request: NextRequest): void {
  if (SAFE_METHODS.has(request.method)) return

  const origin = request.headers.get('origin')
  if (!origin) return

  const allowed = new Set([new URL(publicEnv.appUrl).origin, request.nextUrl.origin])
  if (!allowed.has(origin)) {
    throw new AppError('FORBIDDEN_ORIGIN')
  }
}
