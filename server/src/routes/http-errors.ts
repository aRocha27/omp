import type { Response } from 'express'
import { ZodError } from 'zod'
import type { ConnectionPool } from 'mssql'
import {
  DatabaseRowNotFoundError,
  FacturacaoCapacityError,
  PropagationValidationError,
  RecognitionCapacityError,
  TableUnavailableError,
} from '../db.js'
import { toConnectError } from '../errors.js'
import { logger } from '../logger.js'
import { OrdersProfileNotConfiguredError, ProfileConfigurationError } from '../profiles.js'
import type { ApiErrorCode, ConnectionConfig, Err } from '../types.js'

// Thrown when ad-hoc credentials reach a server that has disabled them. Lives here so both
// the admin router (which produces it) and sendError (which maps it) share one definition.
export class AdHocConnectionsDisabledError extends Error {
  constructor() {
    super('Ad-hoc database connections are disabled in this environment.')
    this.name = 'AdHocConnectionsDisabledError'
  }
}

// A route-level error carrying its own HTTP status and stable ApiErrorCode. This is the
// error-code→status map for route decisions (forbidden, field-locked, not-found). The raw
// error message is safe to serialize — routes construct it from known inputs, never driver
// noise or credentials.
export class RouteError extends Error {
  readonly status: number
  readonly code: ApiErrorCode
  constructor(code: ApiErrorCode, status: number, message: string) {
    super(message)
    this.name = 'RouteError'
    this.code = code
    this.status = status
  }
}

// Opens a pool, runs `operation`, and always closes the pool. Shared by the admin and
// orders routers so neither leaks a connection when the operation throws.
export async function withPool<T>(
  openPool: (connection: ConnectionConfig) => Promise<ConnectionPool>,
  connection: ConnectionConfig,
  operation: (pool: ConnectionPool) => Promise<T>,
): Promise<T> {
  const pool = await openPool(connection)
  try {
    return await operation(pool)
  } finally {
    await pool.close()
  }
}

// Maps any error a route handler can throw to a stable JSON error response. The raw error
// is never serialized — `toConnectError` sanitizes driver noise and credentials first.
export function sendError(response: Response, error: unknown): void {
  if (error instanceof ZodError) {
    const message = error.issues[0]?.message ?? 'The request is invalid.'
    logger.warn('request rejected', { code: 'validation', message })
    const payload: Err = { ok: false, code: 'validation', message }
    response.status(400).json(payload)
    return
  }

  if (error instanceof RouteError) {
    logger.warn('request rejected', { code: error.code, message: error.message })
    const payload: Err = { ok: false, code: error.code, message: error.message }
    response.status(error.status).json(payload)
    return
  }

  if (error instanceof RecognitionCapacityError || error instanceof FacturacaoCapacityError) {
    response.status(422).json({ ok: false, code: 'capacity-exceeded', message: error.message })
    return
  }

  if (error instanceof PropagationValidationError) {
    response.status(422).json({ ok: false, code: 'validation', message: error.message })
    return
  }

  if (error instanceof DatabaseRowNotFoundError) {
    response.status(404).json({ ok: false, code: 'not-found', message: error.message })
    return
  }

  if (error instanceof AdHocConnectionsDisabledError) {
    logger.warn('request rejected', { code: 'ad-hoc-disabled' })
    const payload: Err = { ok: false, code: 'ad-hoc-disabled', message: error.message }
    response.status(403).json(payload)
    return
  }

  if (error instanceof ProfileConfigurationError) {
    logger.warn('request rejected', { code: 'profile', message: error.message })
    const payload: Err = { ok: false, code: 'profile', message: error.message }
    response.status(400).json(payload)
    return
  }

  if (error instanceof OrdersProfileNotConfiguredError) {
    logger.warn('request rejected', { code: 'orders-not-configured', message: error.message })
    const payload: Err = {
      ok: false,
      code: 'orders-not-configured',
      message: error.message,
    }
    response.status(502).json(payload)
    return
  }

  if (error instanceof TableUnavailableError) {
    logger.warn('request rejected', { code: 'table-not-available' })
    const payload: Err = { ok: false, code: 'table-not-available', message: error.message }
    response.status(400).json(payload)
    return
  }

  const safe = toConnectError(error)
  // Log only the sanitized code/message — the raw error may echo credentials back from the
  // driver, so it is never written to the log.
  logger.error('database request failed', { code: safe.code, message: safe.message })
  const payload: Err = { ok: false, code: safe.code, message: safe.message }
  response.status(502).json(payload)
}
