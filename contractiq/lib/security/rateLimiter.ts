import 'server-only'
import type { NextRequest } from 'next/server'
import { AppError, rateLimitMessage } from '@/lib/api/errors'
import { createAdminClient } from '@/lib/supabase/admin'
import { sha256Hex } from '@/lib/utils/hash'
import { logger } from '@/lib/utils/logger'

/** Sliding-window limits (security plan §3). */
export const RATE_LIMITS = {
  auth: { limit: 10, windowSeconds: 60 },
  chat: { limit: 30, windowSeconds: 60 },
  process: { limit: 5, windowSeconds: 3600 },
  upload: { limit: 20, windowSeconds: 86_400 },
} as const

export type RateLimitAction = keyof typeof RATE_LIMITS

/** Rate-limit subject: the verified user id, or a salted hash of the client IP for anonymous auth requests. */
export type RateLimitSubject = { userId: string } | { ip: string }

/**
 * Client IP, preferring headers set by the platform over client-controllable ones:
 * Netlify's connection IP → x-real-ip → first x-forwarded-for hop → Next's request.ip.
 */
export function clientIp(request: NextRequest): string {
  const platform = request.headers.get('x-nf-client-connection-ip')?.trim()
  const real = request.headers.get('x-real-ip')?.trim()
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return platform || real || forwarded || request.ip || 'unknown'
}

function subjectKey(subject: RateLimitSubject): { key: string; userId: string | null } {
  if ('userId' in subject) return { key: `user:${subject.userId}`, userId: subject.userId }
  // IPs are personal data under GDPR: store only a salted hash.
  return { key: `ip:${sha256Hex(`${process.env.USER_ID_HASH_SALT ?? ''}:${subject.ip}`).slice(0, 32)}`, userId: null }
}

/**
 * Sliding-window limiter backed by `rate_limit_events`, read and written only with the service role so
 * users cannot see or manipulate their own counts. Throws 429 RATE_LIMITED (Retry-After set by
 * withApiHandler). Fails open — logged at error level — if the limiter itself is unavailable.
 */
export async function enforceRateLimit(action: RateLimitAction, subject: RateLimitSubject, now: Date = new Date()): Promise<void> {
  const { limit, windowSeconds } = RATE_LIMITS[action]
  const admin = createAdminClient()
  if (!admin) {
    logger.error('rate_limit_unavailable', { action, reason: 'service role not configured' })
    return
  }

  const { key, userId } = subjectKey(subject)
  const windowStart = new Date(now.getTime() - windowSeconds * 1000).toISOString()

  const { data: recent, error } = await admin
    .from('rate_limit_events')
    .select('created_at')
    .eq('subject', key)
    .eq('action', action)
    .gte('created_at', windowStart)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    logger.error('rate_limit_check_failed', { action, code: error.code, errorMessage: error.message })
    return
  }

  if ((recent?.length ?? 0) >= limit) {
    // The window frees up when the oldest of the last `limit` events expires.
    const oldest = new Date(recent![recent!.length - 1].created_at).getTime()
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowSeconds * 1000 - now.getTime()) / 1000))
    throw new AppError('RATE_LIMITED', rateLimitMessage(retryAfterSeconds), { retryAfterSeconds })
  }

  const { error: insertError } = await admin
    .from('rate_limit_events')
    .insert({ user_id: userId, subject: key, action, created_at: now.toISOString() })
  if (insertError) logger.error('rate_limit_record_failed', { action, code: insertError.code, errorMessage: insertError.message })
}
