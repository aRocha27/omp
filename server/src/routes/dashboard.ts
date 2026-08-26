import { Router, type Request, type Response } from 'express'
import type { ConnectionPool } from 'mssql'
import type {
  ConnectionConfig,
  DashboardSnapshotRow,
  DashboardRecognitionQueueRow,
  OkDashboard,
  OkRecognitionQueue,
  OkRecognitionReport,
  OkRecognitionReportOptions,
  RecognitionReportOptions,
  RecognitionReportRow,
} from '../types.js'
import { recognitionReportListBodySchema } from '../validation.js'
import { sendError, withPool } from './http-errors.js'

// Dashboard reads through the same managed Orders profile as the Orders/Clients slices. The
// browser never sends DB credentials; the server resolves the profile from env.
export interface DashboardDependencies {
  resolveOrdersProfile: () => ConnectionConfig
  openPool: (connection: ConnectionConfig) => Promise<ConnectionPool>
  fetchDashboardSnapshot: (pool: ConnectionPool) => Promise<DashboardSnapshotRow>
  fetchRecognitionQueue: (pool: ConnectionPool) => Promise<DashboardRecognitionQueueRow[]>
  fetchRecognitionReport: (
    pool: ConnectionPool,
    filters: Parameters<typeof fetchRecognitionReportImpl>[1],
    limit: number,
  ) => Promise<RecognitionReportRow[]>
  fetchRecognitionReportOptions: (pool: ConnectionPool) => Promise<RecognitionReportOptions>
}

// Signature alias keeps the dependency surface above readable without leaking the
// `db.ts` import into the routes layer.
type fetchRecognitionReportImpl = (
  pool: ConnectionPool,
  filters: import('../db.js').RecognitionReportFilters,
  limit: number,
) => Promise<RecognitionReportRow[]>

export function createDashboardRouter(dependencies: DashboardDependencies): Router {
  const router = Router()

  router.get('/api/dashboard', async (_request: Request, response: Response) => {
    try {
      const connection = dependencies.resolveOrdersProfile()
      const dashboard = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.fetchDashboardSnapshot(pool),
      )
      const payload: OkDashboard = { ok: true, dashboard }
      response.json(payload)
    } catch (error) {
      sendError(response, error)
    }
  })

  router.get('/api/dashboard/recognition-queue', async (_request: Request, response: Response) => {
    try {
      const connection = dependencies.resolveOrdersProfile()
      const rows = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.fetchRecognitionQueue(pool),
      )
      const payload: OkRecognitionQueue = { ok: true, recognitionQueue: rows }
      response.json(payload)
    } catch (error) {
      sendError(response, error)
    }
  })

  router.post('/api/recognition/list', async (request: Request, response: Response) => {
    try {
      const body = recognitionReportListBodySchema.parse(request.body)
      const connection = dependencies.resolveOrdersProfile()
      const rows = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.fetchRecognitionReport(pool, body.filters, body.limit),
      )
      const payload: OkRecognitionReport = { ok: true, rows }
      response.json(payload)
    } catch (error) {
      sendError(response, error)
    }
  })

  router.get('/api/recognition/filter-options', async (_request: Request, response: Response) => {
    try {
      const connection = dependencies.resolveOrdersProfile()
      const options = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.fetchRecognitionReportOptions(pool),
      )
      const payload: OkRecognitionReportOptions = { ok: true, options }
      response.json(payload)
    } catch (error) {
      sendError(response, error)
    }
  })

  return router
}
