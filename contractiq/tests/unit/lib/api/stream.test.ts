import { describe, expect, it } from 'vitest'
import { AppError } from '@/lib/api/errors'
import { ndjsonStream } from '@/lib/api/stream'
import { readNdjson } from '@/lib/utils/read-ndjson'

async function collect<T>(iterator: AsyncGenerator<T>): Promise<T[]> {
  const items: T[] = []
  for await (const item of iterator) items.push(item)
  return items
}

describe('ndjsonStream + readNdjson', () => {
  it('round-trips events in order', async () => {
    const response = ndjsonStream(async (emit) => {
      emit({ step: 'analysing' })
      emit({ step: 'done', contractId: 'c1' })
    })
    expect(response.headers.get('Content-Type')).toContain('application/x-ndjson')
    expect(await collect(readNdjson(response.body!))).toEqual([{ step: 'analysing' }, { step: 'done', contractId: 'c1' }])
  })

  it('emits a final error event when run throws', async () => {
    const response = ndjsonStream(async (emit) => {
      emit({ step: 'analysing' })
      throw new AppError('LLM_UNAVAILABLE')
    })
    const events = await collect(readNdjson<{ step: string; code?: string }>(response.body!))
    expect(events.at(-1)).toEqual({
      step: 'error',
      code: 'LLM_UNAVAILABLE',
      message: 'Our AI service is busy. Try again in a few minutes.',
    })
  })

  it('handles events split across chunks', async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"step":"ana'))
        controller.enqueue(encoder.encode('lysing"}\n{"step":"done"}'))
        controller.close()
      },
    })
    expect(await collect(readNdjson(body))).toEqual([{ step: 'analysing' }, { step: 'done' }])
  })
})
