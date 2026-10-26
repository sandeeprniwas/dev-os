type Level = 'info' | 'warn' | 'error'
export type LogFields = Record<string, unknown>

// Single-line JSON logs. Never pass contract text, prompts, chat content, API keys or JWTs.
function write(level: Level, message: string, fields: LogFields = {}): void {
  // Reserved keys are written last so a field can never overwrite them.
  const line = JSON.stringify({ ...serialiseErrors(fields), level, message, time: new Date().toISOString() })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.info(line)
}

function serialiseErrors(fields: LogFields): LogFields {
  const out: LogFields = {}
  for (const [key, value] of Object.entries(fields)) {
    out[key] =
      value instanceof Error ? { name: value.name, message: value.message, stack: value.stack } : value
  }
  return out
}

export const logger = {
  info: (message: string, fields?: LogFields) => write('info', message, fields),
  warn: (message: string, fields?: LogFields) => write('warn', message, fields),
  error: (message: string, fields?: LogFields) => write('error', message, fields),
}
