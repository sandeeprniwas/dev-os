import { afterEach, describe, expect, it, vi } from 'vitest'
import { logger } from '@/lib/utils/logger'

afterEach(() => vi.restoreAllMocks())

function captured(spy: ReturnType<typeof vi.spyOn>) {
  return JSON.parse(spy.mock.calls[0][0] as string)
}

describe('logger', () => {
  it('writes one JSON line with level, message and fields', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    logger.info('api_request', { status: 200 })
    expect(captured(spy)).toMatchObject({ level: 'info', message: 'api_request', status: 200 })
  })

  it('never lets fields overwrite reserved keys', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    logger.error('health_check_failed', { message: 'permission denied', level: 'info' })
    expect(captured(spy)).toMatchObject({ level: 'error', message: 'health_check_failed' })
  })

  it('serialises Error values', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    logger.warn('failed', { error: new TypeError('bad input') })
    expect(captured(spy).error).toMatchObject({ name: 'TypeError', message: 'bad input' })
  })
})
