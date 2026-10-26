import { describe, expect, it } from 'vitest'
import { countTokens } from '@/lib/llm/tokens'

describe('countTokens (o200k_base)', () => {
  it('counts tokens locally', () => {
    expect(countTokens('hello world')).toBe(2)
    expect(countTokens('')).toBe(0)
  })

  it('counts the page markers the model will see', () => {
    expect(countTokens('[PAGE 1]\nThis Agreement')).toBeGreaterThan(countTokens('This Agreement'))
  })
})
