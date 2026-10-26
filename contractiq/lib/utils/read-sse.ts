export type SseEvent<T = unknown> = { event: string; data: T }

/** Async iterator over a Server-Sent Events response body (`event:` + JSON `data:` frames). */
export async function* readSse<T = unknown>(body: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent<T>> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')

      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const frame = parseFrame<T>(buffer.slice(0, boundary))
        buffer = buffer.slice(boundary + 2)
        if (frame) yield frame
        boundary = buffer.indexOf('\n\n')
      }
    }

    const last = parseFrame<T>((buffer + decoder.decode()).trim())
    if (last) yield last
  } finally {
    reader.releaseLock()
  }
}

function parseFrame<T>(frame: string): SseEvent<T> | null {
  if (!frame.trim()) return null
  let event = 'message'
  const dataLines: string[] = []

  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
  }
  if (dataLines.length === 0) return null

  try {
    return { event, data: JSON.parse(dataLines.join('\n')) as T }
  } catch {
    return null
  }
}
