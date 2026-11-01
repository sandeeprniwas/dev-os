import { logger } from '@/lib/utils/logger'
import { normaliseError } from './with-api-handler'

const STREAM_HEADERS = {
  'Cache-Control': 'no-cache, no-transform',
  'X-Accel-Buffering': 'no',
} as const

/**
 * Newline-delimited JSON stream (used by POST /process). Errors thrown by `run` are emitted
 * as a final {"step":"error"} line; the stream always closes.
 */
export function ndjsonStream(run: (emit: (event: object) => void) => Promise<void>): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: object) => controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
      try {
        await run(emit)
      } catch (error) {
        const appError = normaliseError(error)
        logger.error('ndjson_stream_failed', { code: appError.code, error })
        emit({ step: 'error', code: appError.code, message: appError.message })
      } finally {
        controller.close()
      }
    },
  })
  return new Response(body, {
    status: 200,
    headers: { ...STREAM_HEADERS, 'Content-Type': 'application/x-ndjson; charset=utf-8' },
  })
}
