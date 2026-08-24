import type { ErrorCode } from './types.js'

// Maps mssql / tedious / network errors to stable, user-readable codes.
// The password MUST NEVER appear in the message or be logged.

export class ConnectError extends Error {
  readonly code: ErrorCode
  constructor(code: ErrorCode, message: string) {
    super(message)
    this.name = 'ConnectError'
    this.code = code
  }
}

// Sanitize an error's message so we never leak credentials or raw driver noise.
// Returns a value safe to send to the client.
export function toConnectError(err: unknown): ConnectError {
  const raw = pickMessage(err)
  const lower = raw.toLowerCase()
  const code = pickCode(err)

  // Login / auth failures (tedious ELOGIN, mssql ConnectionError variants).
  if (
    code === 'ELOGIN' ||
    lower.includes('login failed') ||
    lower.includes('elogin') ||
    lower.includes('authentication')
  ) {
    return new ConnectError('login-failed', 'Login failed. Check the username and password.')
  }

  // Timeouts.
  if (
    code === 'ETIMEOUT' ||
    lower.includes('timeout') ||
    lower.includes('etimedout') ||
    lower.includes('requesttimeout')
  ) {
    return new ConnectError(
      'timeout',
      'The connection timed out. Check that the server is reachable.',
    )
  }

  // Unreachable host / network.
  if (
    code === 'ESOCKET' ||
    code === 'ECONNCLOSED' ||
    code === 'EINSTLOOKUP' ||
    lower.includes('enotfound') ||
    lower.includes('econnrefused') ||
    lower.includes('econnreset') ||
    lower.includes('ehostunreach') ||
    lower.includes('enetunreach') ||
    lower.includes('failed to connect') ||
    lower.includes('unable to connect')
  ) {
    return new ConnectError(
      'unreachable',
      'Could not reach the SQL Server. Check the host and port.',
    )
  }

  // Permission / access denied on the server side.
  if (lower.includes('permission') || lower.includes('access denied') || lower.includes('denied')) {
    return new ConnectError(
      'permission',
      'Permission denied. The account lacks access to this database.',
    )
  }

  return new ConnectError(
    'unknown',
    'An unexpected error occurred while connecting to the database.',
  )
}

function pickCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: unknown }).code
    if (typeof code === 'string') return code.toUpperCase()
  }
  return ''
}

function pickMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message
    if (typeof m === 'string') return m
  }
  return ''
}
