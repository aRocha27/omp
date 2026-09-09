import { Router, type Request, type Response } from 'express'
import type { ConnectionPool } from 'mssql'
import type { ConnectionConfig, InvoicingSnapshotRow, OkInvoicing } from '../types.js'
import { sendError, withPool } from './http-errors.js'

export interface InvoicingDependencies {
  resolveOrdersProfile: () => ConnectionConfig
  openPool: (connection: ConnectionConfig) => Promise<ConnectionPool>
  fetchInvoicingSnapshot: (pool: ConnectionPool) => Promise<InvoicingSnapshotRow>
}

export function createInvoicingRouter(dependencies: InvoicingDependencies): Router {
  const router = Router()

  router.get('/api/invoicing', async (_request: Request, response: Response) => {
    try {
      const connection = dependencies.resolveOrdersProfile()
      const invoicing = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.fetchInvoicingSnapshot(pool),
      )
      const payload: OkInvoicing = { ok: true, invoicing }
      response.json(payload)
    } catch (error) {
      sendError(response, error)
    }
  })

  return router
}
