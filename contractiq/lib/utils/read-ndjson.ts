/** Async iterator over a newline-delimited JSON response body. Malformed lines are skipped. */
export async function* readNdjson<T>(body: ReadableStream<Uint8Array>): AsyncGenerator<T> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let newline = buffer.indexOf('\n')
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim()
        buffer = buffer.slice(newline + 1)
        const parsed = parseLine<T>(line)
        if (parsed !== undefined) yield parsed
        newline = buffer.indexOf('\n')
      }
    }

    const last = parseLine<T>((buffer + decoder.decode()).trim())
    if (last !== undefined) yield last
  } finally {
    reader.releaseLock()
  }
}

function parseLine<T>(line: string): T | undefined {
  if (!line) return undefined
  try {
    return JSON.parse(line) as T
  } catch {
    return undefined
  }
}
