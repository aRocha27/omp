// Tiny structured logger for the Administration API.
//
// Writes timestamped, leveled lines to stdout/stderr so the operator can see
// exactly which step of a database request failed while watching the server
// terminal. Every logged value is server-side only; the password MUST NEVER
// appear here — connection callers pass only safe fields (server, port,
// database, user, profileId, error code).

type Level = 'info' | 'warn' | 'error'

const SENSITIVE_KEYS = ['password', 'passwd', 'secret', 'token', 'authorization']

export const logger = {
  info: (message: string, meta?: Record<string, unknown>): void => emit('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>): void => emit('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>): void => emit('error', message, meta),
}

function emit(level: Level, message: string, meta?: Record<string, unknown>): void {
  const stamp = new Date().toISOString()
  const suffix = meta ? ` ${safeJson(meta)}` : ''
  const line = `${stamp} [${level.toUpperCase()}] ${message}${suffix}`
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

// Serializes metadata while replacing any sensitive key's value with
// '<redacted>'. Defends against accidentally logging a password field.
function safeJson(meta: Record<string, unknown>): string {
  try {
    return JSON.stringify(redact(meta))
  } catch {
    return '{<unserializable>}'
  }
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [
        key,
        isSensitive(key) ? '<redacted>' : redact(val),
      ]),
    )
  }
  return value
}

function isSensitive(key: string): boolean {
  return SENSITIVE_KEYS.includes(key.toLowerCase())
}