import cors from 'cors'
import express, {
  type ErrorRequestHandler,
  type Express,
  type Request,
  type Response,
} from 'express'
import { adminAuthentication, authenticate, buildAdminAuthConfig, createAuthRouter, type AdminAuthConfig } from './auth.js'
import { fetchAllTables, fetchRows, listTables, openPool } from './repositories/database.js'
import {
  fetchMasterData,
  createMasterData,
  deleteMasterData,
  updateMasterData,
} from './repositories/master-data.repository.js'
import {
  fetchUtilizadores,
  createUtilizador,
  fetchAreas,
  fetchClientById,
  fetchClientSummaries,
  createClient,
  updateClient,
  fetchFacturacao,
  fetchAllFacturacao,
  fetchFacturacaoTypes,
  fetchInstrumentos,
  fetchProdutos,
  addReconhecimento,
  updateReconhecimento,
  deleteReconhecimento,
  propagateReconhecimento,
  addFacturacao,
  updateFacturacao,
  deleteFacturacao,
  fetchKitConsumables,
  addKitConsumable,
  updateKitConsumable,
  deleteKitConsumable,
  fetchOrderById,
  fetchOrderSummaries,
  fetchPagedOrderSummaries,
  fetchOrderFacets,
  fetchReconhecimentos,
  createOrder,
  fetchDashboardSnapshot,
  fetchRecognitionQueue,
  fetchPendingRecognition,
  fetchPendingRecognitionCount,
  fetchNotFullyInvoiced,
  fetchNotFullyInvoicedCount,
  fetchWarrantyMissing,
  fetchWarrantyMissingCount,
  fetchRecognitionReport,
  fetchRecognitionReportOptions,
  fetchRecognitionReportFacets,
  fetchBacklogReport,
  fetchBacklogTodayReport,
  fetchBacklogYearlyTodayReport,
  fetchInvoicingSnapshot,
  updateOrder,
  updateOrderWarrantyYears,
  appendOrderAudit,
  findAuthUser,
  updateAuthFailure,
  setPassword,
  markAuthSuccess,
} from './db.js'
import { logger } from './logger.js'
import { listProfileMetadata, resolveOrdersProfile, resolveProfile } from './profiles.js'
import { createAdminRouter, type AdminDependencies } from './routes/admin.js'
import {
  createStockMovement,
  fetchStock,
  fetchStockMovements,
} from './repositories/stock.repository.js'
import { createClientsRouter, type ClientsDependencies } from './routes/clients.js'
import { createDashboardRouter, type DashboardDependencies } from './routes/dashboard.js'
import { createInvoicingRouter, type InvoicingDependencies } from './routes/invoicing.js'
import { createOrdersRouter, type OrdersDependencies } from './routes/orders.js'
import { createReferenceRouter, type ReferenceDependencies } from './routes/reference.js'
import { buildEmailDependencies } from './email.js'
import { resolveSelectedDatabase, runDatabaseSelectionContext } from './database-selection.js'

export type AppDependencies = AdminDependencies &
  OrdersDependencies &
  ClientsDependencies &
  DashboardDependencies &
  InvoicingDependencies &
  ReferenceDependencies & Partial<{
    findAuthUser: typeof findAuthUser
    updateAuthFailure: typeof updateAuthFailure
    setPassword: typeof setPassword
    markAuthSuccess: typeof markAuthSuccess
  }>

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
    fetchMasterData,
    createMasterData,
    deleteMasterData,
    updateMasterData,
    fetchStock,
    fetchStockMovements,
    createStockMovement,
     resolveOrdersProfile: () => resolveSelectedDatabase(resolveOrdersProfile(environment)),
    fetchOrderSummaries,
    fetchPagedOrderSummaries,
    fetchOrderFacets,
    fetchOrderById,
    fetchDashboardSnapshot,
    fetchRecognitionQueue,
    fetchPendingRecognition,
    fetchPendingRecognitionCount,
    fetchNotFullyInvoiced,
    fetchNotFullyInvoicedCount,
    fetchWarrantyMissing,
    fetchWarrantyMissingCount,
    fetchRecognitionReport,
    fetchRecognitionReportOptions,
    fetchRecognitionReportFacets,
    fetchBacklogReport,
    fetchBacklogTodayReport,
    fetchBacklogYearlyTodayReport,
    fetchInvoicingSnapshot,
    updateOrder,
    createOrder,
    updateOrderWarrantyYears,
    appendOrderAudit,
    sendEmail: buildEmailDependencies(environment).send,
    fetchReconhecimentos,
    fetchFacturacao,
    fetchAllFacturacao,
    fetchFacturacaoTypes,
    addReconhecimento,
    updateReconhecimento,
    deleteReconhecimento,
    propagateReconhecimento,
    addFacturacao,
    updateFacturacao,
    deleteFacturacao,
    fetchKitConsumables,
    addKitConsumable,
    updateKitConsumable,
    deleteKitConsumable,
    fetchClientSummaries,
    fetchClientById,
    createClient,
    updateClient,
    fetchAreas,
    fetchProdutos,
    fetchInstrumentos,
    findAuthUser,
    updateAuthFailure,
    setPassword,
    markAuthSuccess,
  }
}

export function createApp(
  dependencies: AppDependencies = buildDefaultDependencies(),
  authConfig: AdminAuthConfig = buildAdminAuthConfig(),
): Express {
  void authConfig
  const app = express()
  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173'

  app.disable('x-powered-by')
  app.use(securityHeaders)
  app.use(cors({ origin: corsOrigin, credentials: true }))
  app.use(requestLogger)
  // Email sends may include selected PDFs encoded in the request body.
  app.use(express.json({ limit: '25mb' }))
  app.get('/healthz', (_request, response) => response.json({ ok: true }))
  app.get('/api/healthz', (_request, response) => response.json({ ok: true }))
  const authSource = dependencies as AppDependencies & Required<Pick<AppDependencies, 'findAuthUser' | 'updateAuthFailure' | 'setPassword' | 'markAuthSuccess'>>
  const authDependencies = {
    resolveOrdersProfile: () => dependencies.resolveOrdersProfile?.() ?? dependencies.resolveProfile('orders'),
    openPool: dependencies.openPool,
    findAuthUser: authSource.findAuthUser,
    updateAuthFailure: authSource.updateAuthFailure,
    setPassword: authSource.setPassword,
    markAuthSuccess: authSource.markAuthSuccess,
  }
  app.use(createAuthRouter(authDependencies))
  if (process.env.NODE_ENV === 'test') app.use('/api', adminAuthentication(authConfig))
  app.use('/api', (request, response, next) => {
    if (process.env.NODE_ENV === 'test') { next(); return }
    authenticate(authDependencies)(request, response, (error) => {
      if (error) { next(error); return }
       if (request.authUser) request.headers['x-user-role'] = request.authUser.role.toLowerCase()
       runDatabaseSelectionContext(request, response, next)
    })
  })
  app.use('/api', originProtection)
  app.use(createAdminRouter(dependencies))
  app.use(
    createOrdersRouter(dependencies, {
      authenticatedAdmin: process.env.NODE_ENV === 'test' && authConfig.token !== null,
    }),
  )
  app.use(
    createClientsRouter(dependencies, {
      authenticatedAdmin: process.env.NODE_ENV === 'test' && authConfig.token !== null,
    }),
  )
  app.use(createDashboardRouter(dependencies))
  app.use(createInvoicingRouter(dependencies))
  app.use(createReferenceRouter(dependencies))
  app.use(errorHandler)

  return app
}

function securityHeaders(_request: Request, response: Response, next: () => void): void {
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'no-referrer')
  response.setHeader('X-Frame-Options', 'DENY')
  if (process.env.NODE_ENV === 'production' && process.env.HTTPS_ENFORCED === 'true') {
    response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  next()
}

function originProtection(request: Request, response: Response, next: () => void): void {
  if (process.env.NODE_ENV === 'test' || ['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    next()
    return
  }
  const expected = process.env.CORS_ORIGIN?.trim() || 'http://localhost:5173'
  const origin = request.get('origin')
  const referer = request.get('referer')
  let valid = origin === expected
  if (!origin && referer) {
    try {
      valid = new URL(referer).origin === expected
    } catch {
      valid = false
    }
  }
  if (!valid) {
    response.status(403).json({ ok: false, code: 'forbidden', message: 'Request origin is not allowed.' })
    return
  }
  next()
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
