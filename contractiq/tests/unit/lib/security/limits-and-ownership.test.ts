import { describe, expect, it, vi } from 'vitest'
import type { DbClient } from '@/lib/db/types'
import { verifyContractOwnership, verifySessionOwnership } from '@/lib/security/chatSecurity'
import {
  assertContractTokens,
  assertMessageLength,
  assertPageCount,
  getMaxChatHistory,
  TOKEN_LIMITS,
} from '@/lib/security/tokenLimiter'
import type { ChatSessionRow } from '@/types/domain'

describe('tokenLimiter', () => {
  it('MAX_CHAT_HISTORY defaults to 100 and is clamped', () => {
    expect(getMaxChatHistory({})).toBe(100)
    expect(getMaxChatHistory({ MAX_CHAT_HISTORY: '20' })).toBe(20)
    expect(getMaxChatHistory({ MAX_CHAT_HISTORY: '5000' })).toBe(198)
    expect(getMaxChatHistory({ MAX_CHAT_HISTORY: 'abc' })).toBe(100)
    expect(getMaxChatHistory({ MAX_CHAT_HISTORY: '' })).toBe(100)
    expect(getMaxChatHistory({ MAX_CHAT_HISTORY: '0' })).toBe(0)
  })

  it('enforces page, message and token limits', () => {
    expect(() => assertPageCount(TOKEN_LIMITS.maxPageCount)).not.toThrow()
    expect(() => assertPageCount(TOKEN_LIMITS.maxPageCount + 1)).toThrow(expect.objectContaining({ code: 'TOO_MANY_PAGES' }))
    expect(() => assertMessageLength('x'.repeat(TOKEN_LIMITS.maxMessageLength + 1))).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR', status: 422 }),
    )
    expect(() => assertContractTokens('word '.repeat(20_000))).toThrow(expect.objectContaining({ code: 'TOO_LONG' }))
    expect(assertContractTokens('short contract')).toBeGreaterThan(0)
  })
})

function fakeDb(row: unknown): DbClient {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
  }
  return { from: vi.fn(() => builder) } as unknown as DbClient
}

describe('chatSecurity', () => {
  const contract = { id: 'c1', user_id: 'u1', status: 'completed' }

  it('returns the contract for its owner', async () => {
    await expect(verifyContractOwnership(fakeDb(contract), 'c1', 'u1', { requireCompleted: true })).resolves.toMatchObject({ id: 'c1' })
  })

  it('404s for another user (even if a row were returned)', async () => {
    await expect(verifyContractOwnership(fakeDb(contract), 'c1', 'u2')).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 })
    await expect(verifyContractOwnership(fakeDb(null), 'c1', 'u1')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('only allows chat on completed contracts', async () => {
    await expect(
      verifyContractOwnership(fakeDb({ ...contract, status: 'uploaded' }), 'c1', 'u1', { requireCompleted: true }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('verifies session owner and contract', () => {
    const session = { id: 's1', user_id: 'u1', contract_id: 'c1' } as ChatSessionRow
    expect(verifySessionOwnership(session, 'u1', 'c1')).toBe(session)
    expect(() => verifySessionOwnership(session, 'u2', 'c1')).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }))
    expect(() => verifySessionOwnership(session, 'u1', 'c2')).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }))
    expect(() => verifySessionOwnership(null, 'u1', 'c1')).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }))
  })
})
