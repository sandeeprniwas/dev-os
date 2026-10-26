import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state: { events: { created_at: string }[]; inserted: unknown[]; selectError: unknown } = {
  events: [],
  inserted: [],
  selectError: null,
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => {
      const builder: Record<string, unknown> = {}
      for (const method of ['select', 'eq', 'gte', 'order']) builder[method] = vi.fn(() => builder)
      builder.limit = vi.fn((n: number) => Promise.resolve({ data: state.events.slice(0, n), error: state.selectError }))
      builder.insert = vi.fn((row: unknown) => {
        state.inserted.push(row)
        return Promise.resolve({ error: null })
      })
      return builder
    },
  }),
}))

const { clientIp, enforceRateLimit, RATE_LIMITS } = await import('@/lib/security/rateLimiter')

beforeEach(() => {
  state.events = []
  state.inserted = []
  state.selectError = null
})

describe('enforceRateLimit (sliding window)', () => {
  const now = new Date('2026-10-25T12:00:00Z')

  it('records an event when under the limit', async () => {
    await enforceRateLimit('chat', { userId: 'u1' }, now)
    expect(state.inserted).toEqual([{ user_id: 'u1', subject: 'user:u1', action: 'chat', created_at: now.toISOString() }])
  })

  it('throws 429 with Retry-After once the window is full', async () => {
    // 30 chat events in the last minute, newest first; the oldest was 50 s ago → frees in 10 s.
    state.events = Array.from({ length: RATE_LIMITS.chat.limit }, (_, i) => ({
      created_at: new Date(now.getTime() - (i === RATE_LIMITS.chat.limit - 1 ? 50_000 : 1_000)).toISOString(),
    }))
    await expect(enforceRateLimit('chat', { userId: 'u1' }, now)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
      details: { retryAfterSeconds: 10 },
    })
    expect(state.inserted).toHaveLength(0)
  })

  it('hashes IP subjects for anonymous auth requests (no raw IP stored)', async () => {
    await enforceRateLimit('auth', { ip: '203.0.113.7' }, now)
    const row = state.inserted[0] as { subject: string; user_id: null }
    expect(row.user_id).toBeNull()
    expect(row.subject).toMatch(/^ip:[0-9a-f]{32}$/)
    expect(row.subject).not.toContain('203.0.113.7')
  })

  it('fails open when the limiter store errors', async () => {
    state.selectError = { code: '500', message: 'down' }
    await expect(enforceRateLimit('upload', { userId: 'u1' }, now)).resolves.toBeUndefined()
  })

  it('uses the configured limits', () => {
    expect(RATE_LIMITS).toEqual({
      auth: { limit: 10, windowSeconds: 60 },
      chat: { limit: 30, windowSeconds: 60 },
      process: { limit: 5, windowSeconds: 3600 },
      upload: { limit: 20, windowSeconds: 86_400 },
    })
  })
})

describe('clientIp', () => {
  it('prefers the platform connection IP over client-controllable headers', () => {
    const request = new NextRequest('http://localhost/api/auth/login', {
      headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2', 'x-nf-client-connection-ip': '9.9.9.9' },
    })
    expect(clientIp(request)).toBe('9.9.9.9')
  })
})
