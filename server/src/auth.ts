import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { Router, type Request, type RequestHandler } from 'express'
import { logger } from './logger.js'
import { RouteError, sendError, withPool } from './routes/http-errors.js'
import type { ConnectionConfig, AuthUser, UtilizadorRow } from './types.js'
import type { ConnectionPool } from 'mssql'

const sessions = new Map<string, { userId: string; username: string; expiresAt: number }>()
const attempts = new Map<string, { count: number; until: number }>()
const SESSION_TTL_MS = 8 * 60 * 60 * 1000
const MAX_FAILURES = 5
const COOLDOWN_MS = 60 * 1000
const MAX_TRACKED_ATTEMPTS = 10_000
const COOKIE = 'orders_session'

type Environment = Record<string, string | undefined>

export interface AdminAuthConfig {
  // null = tokenless mode. Allowed only on loopback (dev); the boot guard in
  // buildAdminAuthConfig refuses a non-loopback HOST without a token, so a
  // tokenless API can never be reached over the network.
  token: string | null
}

export interface AuthDependencies {
  resolveOrdersProfile: () => ConnectionConfig
  openPool: (connection: ConnectionConfig) => Promise<ConnectionPool>
  findAuthUser: (pool: ConnectionPool, username: string) => Promise<UtilizadorRow | null>
  updateAuthFailure: (pool: ConnectionPool, username: string) => Promise<void>
  setPassword: (pool: ConnectionPool, id: string, hash: string, firstLogin: boolean) => Promise<void>
  markAuthSuccess: (pool: ConnectionPool, id: string) => Promise<void>
}

export function buildAdminAuthConfig(environment: Environment = process.env): AdminAuthConfig {
  const token = environment.ADMIN_API_TOKEN?.trim() || null
  if (!token && environment.NODE_ENV === 'test') {
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

declare global { namespace Express { interface Request { authUser?: AuthUser } } }

export function createAuthRouter(deps: AuthDependencies): Router {
  const router = Router()
  router.post('/api/auth/login', async (request, response) => {
    try {
      const username = typeof request.body?.username === 'string' ? request.body.username.trim() : ''
      const password = typeof request.body?.password === 'string' ? request.body.password : ''
      if (!username || username.length > 30) throw new RouteError('validation', 400, 'Username is required.')
      const key = username.toLowerCase(); const attempt = attempts.get(key)
      if (attempt && attempt.until > Date.now()) throw new RouteError('unauthorized', 401, 'Invalid username or password.')
      const user = await withPool(deps.openPool, deps.resolveOrdersProfile(), (pool) => deps.findAuthUser(pool, username))
      if (!user || user.Cancelado === true || user.Admin === true && user.Read_Only === true) return invalidLogin(deps, username, response)
      const firstLogin = user.NewUser === true || user.NewUser == null && !user.Pwd
      if (firstLogin && !password) return response.json({ ok: true, firstLogin: true })
      if (firstLogin || !user.Pwd || !(await verifyPassword(password, user.Pwd))) return invalidLogin(deps, username, response)
      await withPool(deps.openPool, deps.resolveOrdersProfile(), (pool) => deps.markAuthSuccess(pool, user.ID_User))
      return authenticatedResponse(response, user)
    } catch (error) { return sendError(response, error) }
  })
  router.post('/api/auth/first-password', async (request, response) => {
    try {
      const username = typeof request.body?.username === 'string' ? request.body.username.trim() : ''
      const password = typeof request.body?.password === 'string' ? request.body.password : ''
      const confirmation = typeof request.body?.confirmation === 'string' ? request.body.confirmation : ''
      if (!username || !validPassword(password) || password !== confirmation) throw new RouteError('validation', 400, 'Password must be at least 10 characters and match confirmation.')
      const user = await withPool(deps.openPool, deps.resolveOrdersProfile(), (pool) => deps.findAuthUser(pool, username))
      if (!user || user.Cancelado === true || !(user.NewUser === true || user.NewUser == null && !user.Pwd)) throw new RouteError('unauthorized', 401, 'Invalid username or password.')
      const hash = await hashPassword(password)
      await withPool(deps.openPool, deps.resolveOrdersProfile(), (pool) => deps.setPassword(pool, user.ID_User, hash, true))
      await withPool(deps.openPool, deps.resolveOrdersProfile(), (pool) => deps.markAuthSuccess(pool, user.ID_User))
      return authenticatedResponse(response, user)
    } catch (error) { return sendError(response, error) }
  })
  router.get('/api/auth/me', authenticate(deps), (request, response) => response.json({ ok: true, user: request.authUser }))
  router.post('/api/auth/logout', (request, response) => { const token = cookies(request).get(COOKIE); if (token) sessions.delete(token); response.clearCookie(COOKIE); response.json({ ok: true }) })
  router.post('/api/auth/change-password', authenticate(deps), async (request, response) => {
    try {
      const current = typeof request.body?.currentPassword === 'string' ? request.body.currentPassword : ''
      const password = typeof request.body?.password === 'string' ? request.body.password : ''
      const confirmation = typeof request.body?.confirmation === 'string' ? request.body.confirmation : ''
      if (!validPassword(password) || password !== confirmation) throw new RouteError('validation', 400, 'Password must be at least 10 characters and match confirmation.')
      const user = await withPool(deps.openPool, deps.resolveOrdersProfile(), (pool) => deps.findAuthUser(pool, request.authUser!.username))
      if (!user?.Pwd || !(await verifyPassword(current, user.Pwd))) throw new RouteError('unauthorized', 401, 'Current password is invalid.')
      const hash = await hashPassword(password)
      await withPool(deps.openPool, deps.resolveOrdersProfile(), (pool) => deps.setPassword(pool, user.ID_User, hash, false))
      response.json({ ok: true })
    } catch (error) { sendError(response, error) }
  })
  return router
}

export function authenticate(deps: AuthDependencies): RequestHandler {
  return async (request, response, next) => {
    const token = cookies(request).get(COOKIE); const session = token ? sessions.get(token) : undefined
    if (!session || session.expiresAt <= Date.now()) { if (token) sessions.delete(token); response.status(401).json({ ok: false, code: 'unauthorized', message: 'Authentication is required.' }); return }
    try {
      const user = await withPool(deps.openPool, deps.resolveOrdersProfile(), (pool) => deps.findAuthUser(pool, session.username))
      if (!user || user.Cancelado === true) { sessions.delete(token!); response.status(401).json({ ok: false, code: 'unauthorized', message: 'Authentication is required.' }); return }
      request.authUser = toAuthUser(user); next()
    } catch (error) { next(error) }
  }
}

export function toAuthUser(user: Pick<UtilizadorRow, 'ID_User' | 'User_Name' | 'Read_Only' | 'Admin'>): AuthUser {
  if (user.Admin) { if (user.Read_Only) throw new RouteError('forbidden', 403, 'Invalid user role configuration.'); return { id: user.ID_User, username: user.User_Name ?? '', role: 'ADMIN' } }
  return { id: user.ID_User, username: user.User_Name ?? '', role: user.Read_Only ? 'READER' : 'EDITOR' }
}

export function hasPermission(user: AuthUser, permission: 'view' | 'export' | 'create' | 'edit' | 'delete' | 'admin'): boolean {
  if (permission === 'view' || permission === 'export') return true
  if (permission === 'admin') return user.role === 'ADMIN'
  return user.role !== 'READER'
}

async function invalidLogin(deps: AuthDependencies, username: string, response: import('express').Response): Promise<void> {
  const now = Date.now()
  for (const [key, attempt] of attempts) {
    if (attempt.until <= now && attempt.count === 0) attempts.delete(key)
  }
  const key = username.toLowerCase(); const current = attempts.get(key) ?? { count: 0, until: 0 }; current.count += 1
  if (current.count >= MAX_FAILURES) { current.until = Date.now() + COOLDOWN_MS; current.count = 0 }; attempts.set(key, current)
  if (attempts.size > MAX_TRACKED_ATTEMPTS) {
    const oldest = attempts.keys().next().value
    if (oldest !== undefined) attempts.delete(oldest)
  }
  await withPool(deps.openPool, deps.resolveOrdersProfile(), (pool) => deps.updateAuthFailure(pool, username)).catch(() => undefined)
  response.status(401).json({ ok: false, code: 'unauthorized', message: 'Invalid username or password.' })
}

async function hashPassword(password: string): Promise<string> { const salt = randomBytes(16); const key = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 }); return `scrypt$16384$8$1$${salt.toString('base64url')}$${key.toString('base64url')}` }
async function verifyPassword(password: string, encoded: string): Promise<boolean> { try { const [, n, r, p, saltText, hashText] = encoded.split('$'); const salt = Buffer.from(saltText, 'base64url'); const expected = Buffer.from(hashText, 'base64url'); const actual = scryptSync(password, salt, expected.length, { N: Number(n), r: Number(r), p: Number(p) }); return actual.length === expected.length && timingSafeEqual(actual, expected) } catch { return false } }
function validPassword(value: string): boolean { return value.length >= 10 && value.length <= 90 }
function authenticatedResponse(response: import('express').Response, user: UtilizadorRow) { const token = randomBytes(32).toString('base64url'); sessions.set(token, { userId: user.ID_User, username: user.ID_User, expiresAt: Date.now() + SESSION_TTL_MS }); response.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; Max-Age=${SESSION_TTL_MS / 1000}; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`); return response.json({ ok: true, firstLogin: false, user: toAuthUser(user) }) }
function cookies(request: Request): Map<string, string> { const map = new Map<string, string>(); for (const item of (request.headers.cookie ?? '').split(';')) { const [key, ...value] = item.trim().split('='); if (key) map.set(key, decodeURIComponent(value.join('='))) }; return map }

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
