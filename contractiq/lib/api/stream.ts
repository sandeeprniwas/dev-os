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

/**
 * Server-Sent Events stream (used by POST /chat). Frames: `event: <name>\ndata: <json>\n\n`.
 * Errors thrown by `run` are sent as `event: error`; the stream always closes.
 */
export function sseStream(run: (send: (event: string, data: object) => void) => Promise<void>): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: object) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      try {
        await run(send)
      } catch (error) {
        const appError = normaliseError(error)
        logger.error('sse_stream_failed', { code: appError.code, error })
        send('error', { code: appError.code, message: appError.message })
      } finally {
        controller.close()
      }
    },
  })
  return new Response(body, {
    status: 200,
    headers: { ...STREAM_HEADERS, 'Content-Type': 'text/event-stream; charset=utf-8', Connection: 'keep-alive' },
  })
}
