import { describe, expect, it } from 'vitest'
import { AppError } from '@/lib/api/errors'
import { ndjsonStream, sseStream } from '@/lib/api/stream'
import { readNdjson } from '@/lib/utils/read-ndjson'
import { readSse } from '@/lib/utils/read-sse'

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

describe('sseStream + readSse', () => {
  it('round-trips named events', async () => {
    const response = sseStream(async (send) => {
      send('delta', { text: 'Based on the document, ' })
      send('done', { citedPages: [4] })
    })
    expect(response.headers.get('Content-Type')).toContain('text/event-stream')
    expect(await collect(readSse(response.body!))).toEqual([
      { event: 'delta', data: { text: 'Based on the document, ' } },
      { event: 'done', data: { citedPages: [4] } },
    ])
  })

  it('sends an error event when run throws', async () => {
    const response = sseStream(async () => {
      throw new Error('unexpected')
    })
    expect(await collect(readSse(response.body!))).toEqual([
      { event: 'error', data: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Try again.' } },
    ])
  })
})
