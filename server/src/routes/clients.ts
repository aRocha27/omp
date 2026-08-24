import { Router, type Request, type Response } from 'express'
import type { ConnectionPool } from 'mssql'
import type {
  ClientDetailRow,
  ClientSummaryRow,
  ConnectionConfig,
  OkClient,
  OkClients,
} from '../types.js'
import { type ClientListFilters } from '../db.js'
import { clientsListBodySchema, orderIdParamSchema } from '../validation.js'
import { sendError, withPool } from './http-errors.js'

// The Clients endpoints share the Orders managed profile: tokenless on loopback (R-A auth
// gap applies equally here — see orders.ts), read-only. These are the collaborators the
// router needs.
export interface ClientsDependencies {
  resolveOrdersProfile: () => ConnectionConfig
  openPool: (connection: ConnectionConfig) => Promise<ConnectionPool>
  fetchClientSummaries: (
    pool: ConnectionPool,
    filters: ClientListFilters,
    limit: number,
  ) => Promise<ClientSummaryRow[]>
  fetchClientById: (pool: ConnectionPool, id: number) => Promise<ClientDetailRow | null>
}

export function createClientsRouter(dependencies: ClientsDependencies): Router {
  const router = Router()

  router.post('/api/clients/list', async (request: Request, response: Response) => {
    try {
      const body = clientsListBodySchema.parse(request.body)
      const connection = dependencies.resolveOrdersProfile()
      const clients = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.fetchClientSummaries(pool, body.filters, body.limit),
      )
      const payload: OkClients = { ok: true, clients }
      response.json(payload)
    } catch (error) {
      sendError(response, error)
    }
  })

  router.get('/api/clients', async (request: Request, response: Response) => {
    try {
      const id = orderIdParamSchema.parse(request.query.id)
      const connection = dependencies.resolveOrdersProfile()
      const client = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.fetchClientById(pool, id),
      )
      // A missing client is not a 404 — mirrors the orders detail contract: the UI renders
      // its own not-found state from a 200/null rather than distinguishing transport from empty.
      const payload: OkClient = { ok: true, client }
      response.json(payload)
    } catch (error) {
      sendError(response, error)
    }
  })

  return router
}