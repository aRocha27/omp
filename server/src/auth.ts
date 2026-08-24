import { timingSafeEqual } from 'node:crypto'
import type { RequestHandler } from 'express'
import { logger } from './logger.js'

type Environment = Record<string, string | undefined>

export interface AdminAuthConfig {
  // null = tokenless mode. Allowed only on loopback (dev); the boot guard in
  // buildAdminAuthConfig refuses a non-loopback HOST without a token, so a
  // tokenless API can never be reached over the network.
  token: string | null
}

export function buildAdminAuthConfig(environment: Environment = process.env): AdminAuthConfig {
  const token = environment.ADMIN_API_TOKEN?.trim() || null
  if (!token) {
    const host = environment.HOST?.trim() || '127.0.0.1'
    if (!isLoopback(host)) {
      throw new Error(
        'ADMIN_API_TOKEN is required when HOST is not loopback. Tokenless auth is dev-only.',
      )
    }
  }
  return { token }
}

export function adminAuthentication(config: AdminAuthConfig): RequestHandler {
  return (request, response, next) => {
    // No token configured → auth disabled (loopback dev only; guarded at boot).
    if (config.token === null) {
      next()
      return
    }

    const candidate = bearerToken(request.headers.authorization)
    if (candidate && secureEqual(candidate, config.token)) {
      next()
      return
    }

    const reason = candidate ? 'invalid admin token' : 'missing admin token'
    logger.warn('admin auth rejected', { path: request.originalUrl ?? request.url, reason })
    response.status(401).json({
      ok: false,
      code: 'unauthorized',
      message: 'Administrator authentication is required.',
    })
  }
}

function isLoopback(host: string): boolean {
  return host === '127.0.0.1' || host === '::1' || host === 'localhost'
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice('Bearer '.length).trim()
  return token || null
}

function secureEqual(candidate: string, expected: string): boolean {
  const candidateBuffer = Buffer.from(candidate)
  const expectedBuffer = Buffer.from(expected)
  return (
    candidateBuffer.length === expectedBuffer.length &&
    timingSafeEqual(candidateBuffer, expectedBuffer)
  )
}