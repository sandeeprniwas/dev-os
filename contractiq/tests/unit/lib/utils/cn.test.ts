import { describe, expect, it } from 'vitest'
import { cn } from '@/lib/utils/cn'

describe('cn', () => {
  it('keeps a text colour alongside a custom design-system font size', () => {
    expect(cn('bg-brand text-fg-inverse', 'h-12 px-6 text-body-lg')).toBe('bg-brand text-fg-inverse h-12 px-6 text-body-lg')
  })

  it('still resolves conflicts within the same group (last wins)', () => {
    expect(cn('text-body', 'text-body-lg')).toBe('text-body-lg')
    expect(cn('text-fg', 'text-danger-700')).toBe('text-danger-700')
    expect(cn('px-4', 'px-6')).toBe('px-6')
  })
})
