import { describe, expect, it } from 'vitest'
import { safeRedirectPath } from '@/lib/auth/redirect'
import { computeCost } from '@/lib/llm/cost'
import { confidenceLevel } from '@/lib/utils/confidence'
import { slugify } from '@/lib/utils/slugify'
import { customTermsBodySchema } from '@/lib/validation/custom-terms'
import { signupSchema } from '@/lib/validation/auth'
import { parseContractsQuery } from '@/lib/validation/contracts-query'

describe('safeRedirectPath (open-redirect protection)', () => {
  it.each([
    ['/contracts/abc', '/contracts/abc'],
    ['/dashboard?page=2', '/dashboard?page=2'],
    [null, '/dashboard'],
    ['', '/dashboard'],
    ['https://evil.com', '/dashboard'],
    ['//evil.com', '/dashboard'],
    ['/\\evil.com', '/dashboard'],
    ['/foo://bar', '/dashboard'],
    ['dashboard', '/dashboard'],
    ['/' + 'a'.repeat(250), '/dashboard'],
  ])('%s → %s', (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected)
  })
})

describe('computeCost', () => {
  it('prices cached and uncached input separately (AC-TEL-03)', () => {
    expect(computeCost('gpt-4o', { prompt_tokens: 19000, completion_tokens: 2500, prompt_tokens_details: { cached_tokens: 4000 } })).toBe(0.0675)
  })
})

describe('confidenceLevel boundaries', () => {
  it.each([
    [100, 'high'],
    [80, 'high'],
    [79, 'medium'],
    [50, 'medium'],
    [49, 'low'],
    [0, 'low'],
  ] as const)('%i → %s', (score, level) => {
    expect(confidenceLevel(score)).toBe(level)
  })
})

describe('slugify', () => {
  it('produces safe storage names', () => {
    expect(slugify('Acme Mutual NDA (v2) — FINAL')).toBe('acme-mutual-nda-v2-final')
    expect(slugify('合同')).toBe('')
  })
})

describe('customTermsBodySchema', () => {
  const schema = customTermsBodySchema('nda')
  it('accepts up to 5 distinct terms', () => {
    expect(schema.safeParse({ terms: ['A one', 'B two', 'C three', 'D four', 'E five'] }).success).toBe(true)
  })
  it('rejects a 6th term, duplicates and standard term names', () => {
    expect(schema.safeParse({ terms: ['A1', 'B2', 'C3', 'D4', 'E5', 'F6'] }).success).toBe(false)
    expect(schema.safeParse({ terms: ['Auto renewal', 'auto  RENEWAL'] }).success).toBe(false)
    expect(schema.safeParse({ terms: ['governing law'] }).success).toBe(false)
  })
})

describe('signupSchema', () => {
  it('requires a letter, a digit and matching confirmation', () => {
    expect(signupSchema.safeParse({ email: 'A@B.co ', password: 'password1', confirmPassword: 'password1' }).success).toBe(true)
    expect(signupSchema.safeParse({ email: 'a@b.co', password: 'password', confirmPassword: 'password' }).success).toBe(false)
    expect(signupSchema.safeParse({ email: 'a@b.co', password: 'password1', confirmPassword: 'password2' }).success).toBe(false)
  })
})

describe('parseContractsQuery', () => {
  it('falls back to defaults for invalid values', () => {
    expect(parseContractsQuery({ sort: 'drop table', order: 'sideways', page: '-3', pageSize: '500', type: 'xyz' })).toEqual({
      sort: 'created_at',
      order: 'desc',
      page: 1,
      pageSize: 20,
      type: undefined,
    })
  })
})
