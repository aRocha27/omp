import cors from 'cors'
import express, { type ErrorRequestHandler, type Express, type Request, type Response } from 'express'
import { adminAuthentication, buildAdminAuthConfig, type AdminAuthConfig } from './auth.js'
import {
  fetchAllTables,
  fetchUtilizadores,
  createUtilizador,
  fetchClientById,
  fetchClientSummaries,
  fetchFacturacao,
  addReconhecimento,
  addFacturacao,
  fetchOrderById,
  fetchOrderSummaries,
  fetchReconhecimentos,
  createOrder,
  fetchRows,
  listTables,
  openPool,
  updateOrder,
} from './db.js'
import { logger } from './logger.js'
import { listProfileMetadata, resolveOrdersProfile, resolveProfile } from './profiles.js'
import { createAdminRouter, type AdminDependencies } from './routes/admin.js'
import { createClientsRouter, type ClientsDependencies } from './routes/clients.js'
import { createOrdersRouter, type OrdersDependencies } from './routes/orders.js'

export type AppDependencies = AdminDependencies & OrdersDependencies & ClientsDependencies

type Environment = Record<string, string | undefined>

export function buildDefaultDependencies(environment: Environment = process.env): AppDependencies {
  return {
    allowAdHocConnections: environment.ALLOW_AD_HOC_CONNECTIONS === 'true',
    adHocTrustServerCertificate: environment.AD_HOC_TRUST_SERVER_CERTIFICATE === 'true',
    listProfileMetadata: () => listProfileMetadata(environment),
    resolveProfile: (profileId) => resolveProfile(profileId, environment),
    openPool,
    listTables,
    fetchRows,
    fetchAllTables,
    fetchUtilizadores,
    createUtilizador,
    resolveOrdersProfile: () => resolveOrdersProfile(environment),
    fetchOrderSummaries,
    fetchOrderById,
    updateOrder,
    createOrder,
    fetchReconhecimentos,
    fetchFacturacao,
    addReconhecimento,
    addFacturacao,
    fetchClientSummaries,
    fetchClientById,
  }
}

export function createApp(
  dependencies: AppDependencies = buildDefaultDependencies(),
  authConfig: AdminAuthConfig = buildAdminAuthConfig(),
): Express {
  const app = express()
  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173'

  app.use(cors({ origin: corsOrigin }))
  app.use(requestLogger)
  app.use('/api', adminAuthentication(authConfig))
  app.use(express.json({ limit: '32kb' }))
  app.use(createAdminRouter(dependencies))
  app.use(createOrdersRouter(dependencies))
  app.use(createClientsRouter(dependencies))
  app.use(errorHandler)

  return app
}

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (isJsonParseError(error)) {
    response.status(400).json({
      ok: false,
      code: 'validation',
      message: 'The request body must be valid JSON.',
    })
    return
  }

  logger.error('unhandled request error', { errorName: errorName(error) })
  response.status(500).json({
    ok: false,
    code: 'unknown',
    message: 'The database service encountered an unexpected error.',
  })
}

function requestLogger(request: Request, response: Response, next: () => void): void {
  const started = Date.now()
  response.on('finish', () => {
    const duration = Date.now() - started
    const { method } = request
    const path = request.originalUrl ?? request.url
    const { statusCode } = response
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info'
    logger[level]('request', { method, path, status: statusCode, durationMs: duration })
  })
  next()
}

function errorName(error: unknown): string {
  if (error instanceof Error) return error.name
  return typeof error === 'string' ? error : 'unknown'
}

function isJsonParseError(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    'status' in error &&
    (error as SyntaxError & { status?: unknown }).status === 400
  )
}
