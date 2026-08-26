import { Router, type Request, type Response } from 'express'
import type { ConnectionPool } from 'mssql'
import type {
  ClientCreateInput,
  ClientDetailRow,
  ClientSummaryRow,
  ConnectionConfig,
  OkClient,
  OkClientCreate,
  OkClientUpdate,
  OkClients,
} from '../types.js'
import { type ClientListFilters } from '../db.js'
import {
  clientCreateBodySchema,
  clientUpdateBodySchema,
  clientsListBodySchema,
  orderIdParamSchema,
} from '../validation.js'
import { RouteError, sendError, withPool } from './http-errors.js'

// The Clients endpoints share the Orders managed profile: tokenless on loopback (R-A auth
// gap applies equally here — see orders.ts), read-only by default. The create/update
// endpoints are admin-only and gated by the request role header. These are the
// collaborators the router needs.
export interface ClientsDependencies {
  resolveOrdersProfile: () => ConnectionConfig
  openPool: (connection: ConnectionConfig) => Promise<ConnectionPool>
  fetchClientSummaries: (
    pool: ConnectionPool,
    filters: ClientListFilters,
    limit: number,
  ) => Promise<ClientSummaryRow[]>
  fetchClientById: (pool: ConnectionPool, id: number) => Promise<ClientDetailRow | null>
  createClient: (
    pool: ConnectionPool,
    input: ClientCreateInput,
    user: string,
  ) => Promise<ClientDetailRow>
  updateClient: (
    pool: ConnectionPool,
    id: number,
    changes: { [key: string]: unknown; user: string },
  ) => Promise<ClientDetailRow | null>
}

type UserRole = 'viewer' | 'editor' | 'admin'

export interface ClientsAuthorization {
  /** A successful request already passed configured bearer-token authentication. */
  authenticatedAdmin: boolean
}

function readUserRole(
  authorization: ClientsAuthorization,
  header: string | string[] | undefined,
): UserRole {
  // A configured bearer token is the authority — never let a caller downgrade or
  // impersonate a different role through the development-only header.
  if (authorization.authenticatedAdmin) return 'admin'

  // Tokenless mode is boot-guarded to loopback. It may simulate roles explicitly,
  // but missing and unrecognised values fail closed as viewer.
  const value = typeof header === 'string' ? header.trim().toLowerCase() : ''
  if (value === 'user' || value === 'editor') return 'editor'
  if (value === 'viewer' || value === 'admin') return value
  return 'viewer'
}

export function createClientsRouter(
  dependencies: ClientsDependencies,
  authorization: ClientsAuthorization,
): Router {
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

  // Admin-only: create a new client row. The role header is the source of truth — there
  // is no "everyone can create" path. Viewers and editors are rejected with 403.
  router.post('/api/clients', async (request: Request, response: Response) => {
    try {
      const body = clientCreateBodySchema.parse(request.body) as ClientCreateInput
      const role = readUserRole(authorization, request.headers['x-user-role'])
      if (role !== 'admin') {
        throw new RouteError('forbidden', 403, 'Only admins may create clients.')
      }
      const connection = dependencies.resolveOrdersProfile()
      const client = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.createClient(pool, body, role),
      )
      const payload: OkClientCreate = { ok: true, client }
      response.status(201).json(payload)
    } catch (error) {
      sendError(response, error)
    }
  })

  // Admin-only: partial update of an existing client. The patch is whitelist-checked by
  // the db layer, so unknown columns can never reach the SET clause.
  router.post('/api/clients/update', async (request: Request, response: Response) => {
    try {
      const body = clientUpdateBodySchema.parse(request.body)
      const role = readUserRole(authorization, request.headers['x-user-role'])
      if (role !== 'admin') {
        throw new RouteError('forbidden', 403, 'Only admins may edit clients.')
      }
      const connection = dependencies.resolveOrdersProfile()
      const updated = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.updateClient(pool, body.id, { ...body.patch, user: role }),
      )
      if (!updated) {
        throw new RouteError('not-found', 404, `Client ${body.id} was not found.`)
      }
      const payload: OkClientUpdate = { ok: true, client: updated }
      response.json(payload)
    } catch (error) {
      sendError(response, error)
    }
  })

  return router
}
