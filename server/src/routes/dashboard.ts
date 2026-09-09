import { Router, type Request, type Response } from 'express'
import type { ConnectionPool } from 'mssql'
import type {
  ConnectionConfig,
  DashboardSnapshotRow,
  DashboardRecognitionQueueRow,
  DashboardPendingRecognitionRow,
  DashboardWarrantyMissingRow,
  InvoicingPendingRow,
  OkDashboard,
  OkRecognitionQueue,
  OkRecognitionReport,
  OkRecognitionReportFacets,
  OkRecognitionReportOptions,
  RecognitionReportFacets,
  RecognitionReportOptions,
  RecognitionReportRow,
  BacklogReportRow,
  OkBacklogReport,
  OkYearlyBacklogReport,
} from '../types.js'
import {
  recognitionFacetsBodySchema,
  recognitionReportListBodySchema,
} from '../validation.js'
import type { RecognitionReportFilters } from '../repositories/recognition-report.repository.js'
import type { BacklogReportFilters } from '../repositories/report.repository.js'
import { sendError, withPool } from './http-errors.js'

// Dashboard reads through the same managed Orders profile as the Orders/Clients slices. The
// browser never sends DB credentials; the server resolves the profile from env.
export interface DashboardDependencies {
  resolveOrdersProfile: () => ConnectionConfig
  openPool: (connection: ConnectionConfig) => Promise<ConnectionPool>
  fetchDashboardSnapshot: (pool: ConnectionPool) => Promise<DashboardSnapshotRow>
  fetchRecognitionQueue: (pool: ConnectionPool) => Promise<DashboardRecognitionQueueRow[]>
  fetchPendingRecognition?: (pool: ConnectionPool) => Promise<DashboardPendingRecognitionRow[]>
  fetchPendingRecognitionCount?: (pool: ConnectionPool) => Promise<number>
  fetchNotFullyInvoiced: (pool: ConnectionPool) => Promise<InvoicingPendingRow[]>
  fetchNotFullyInvoicedCount?: (pool: ConnectionPool) => Promise<number>
  fetchWarrantyMissing: (pool: ConnectionPool) => Promise<DashboardWarrantyMissingRow[]>
  fetchWarrantyMissingCount?: (pool: ConnectionPool) => Promise<number>
  fetchRecognitionReport: (
    pool: ConnectionPool,
    filters: RecognitionReportFilters,
    limit?: number,
  ) => Promise<RecognitionReportRow[]>
  fetchRecognitionReportOptions: (pool: ConnectionPool) => Promise<RecognitionReportOptions>
  fetchRecognitionReportFacets: (
    pool: ConnectionPool,
    filters: RecognitionReportFilters,
  ) => Promise<RecognitionReportFacets>
  fetchBacklogReport?: (pool: ConnectionPool, filters?: BacklogReportFilters) => Promise<BacklogReportRow[]>
  fetchBacklogTodayReport?: (pool: ConnectionPool) => Promise<BacklogReportRow[]>
  fetchBacklogYearlyTodayReport?: (pool: ConnectionPool) => Promise<import('../types.js').YearlyBacklogReportRow[]>
}

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

  router.post('/api/recognition/facets', async (request: Request, response: Response) => {
    try {
      const body = recognitionFacetsBodySchema.parse(request.body)
      const connection = dependencies.resolveOrdersProfile()
      const facets = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.fetchRecognitionReportFacets(pool, body.filters),
      )
      const payload: OkRecognitionReportFacets = { ok: true, facets }
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

  router.post('/api/reports/backlog', async (request: Request, response: Response) => {
    try {
      if (!dependencies.fetchBacklogReport) throw new Error('Backlog report is not configured.')
      const connection = dependencies.resolveOrdersProfile()
      const rows = await withPool(dependencies.openPool, connection, (pool) => dependencies.fetchBacklogReport?.(pool, request.body ?? {}) ?? Promise.resolve([]))
      const payload: OkBacklogReport = { ok: true, rows }
      response.json(payload)
    } catch (error) {
      sendError(response, error)
    }
  })

  router.get('/api/reports/backlog-today', async (_request: Request, response: Response) => {
    try {
      if (!dependencies.fetchBacklogTodayReport) throw new Error('Today backlog report is not configured.')
      const connection = dependencies.resolveOrdersProfile()
      const rows = await withPool(dependencies.openPool, connection, dependencies.fetchBacklogTodayReport)
      const payload: OkBacklogReport = { ok: true, rows }
      response.json(payload)
    } catch (error) {
      sendError(response, error)
    }
  })

  router.get('/api/reports/backlog-yearly-today', async (_request: Request, response: Response) => {
    try {
      if (!dependencies.fetchBacklogYearlyTodayReport) throw new Error('Yearly backlog report is not configured.')
      const connection = dependencies.resolveOrdersProfile()
      const rows = await withPool(dependencies.openPool, connection, dependencies.fetchBacklogYearlyTodayReport)
      const payload: OkYearlyBacklogReport = { ok: true, rows }
      response.json(payload)
    } catch (error) {
      sendError(response, error)
    }
  })

  return router
}
