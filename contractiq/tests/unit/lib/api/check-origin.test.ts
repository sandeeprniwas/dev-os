import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { checkOrigin } from '@/lib/api/check-origin'

const request = (method: string, origin?: string) =>
  new NextRequest('http://localhost:3000/api/contracts', {
    method,
    headers: origin ? { origin } : {},
  })

describe('checkOrigin', () => {
  it('allows safe methods from any origin', () => {
    expect(() => checkOrigin(request('GET', 'https://evil.example'))).not.toThrow()
  })

  it('allows same-origin mutations', () => {
    expect(() => checkOrigin(request('POST', 'http://localhost:3000'))).not.toThrow()
  })

  it('allows mutations without an Origin header (auth still applies)', () => {
    expect(() => checkOrigin(request('DELETE'))).not.toThrow()
  })

  it('blocks cross-origin mutations', () => {
    expect(() => checkOrigin(request('POST', 'https://evil.example'))).toThrow(
      expect.objectContaining({ code: 'FORBIDDEN_ORIGIN', status: 403 }),
    )
  })
})
