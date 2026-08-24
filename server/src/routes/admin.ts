import { Router, type Request, type Response } from 'express'
import type { ConnectionPool } from 'mssql'
import { logger } from '../logger.js'
import { ProfileConfigurationError } from '../profiles.js'
import type {
  ConnectionConfig,
  OkAllTables,
  OkRows,
  OkTables,
  ProfileMetadata,
  TableInfo,
  TableRows,
  OkUtilizadores,
  OkUtilizador,
} from '../types.js'
import {
  connectBodySchema,
  syncAllBodySchema,
  syncBodySchema,
  tablesBodySchema,
  utilizadorCreateBodySchema,
  type ConnectBody,
  type SyncAllBody,
  type SyncBody,
} from '../validation.js'
import {
  AdHocConnectionsDisabledError,
  RouteError,
  sendError,
  withPool,
} from './http-errors.js'

export interface AdminDependencies {
  allowAdHocConnections: boolean
  adHocTrustServerCertificate: boolean
  listProfileMetadata: () => ProfileMetadata[]
  resolveProfile: (profileId: string) => ConnectionConfig
  openPool: (connection: ConnectionConfig) => Promise<ConnectionPool>
  listTables: (pool: ConnectionPool) => Promise<TableInfo[]>
  fetchRows: (
    pool: ConnectionPool,
    schema: string,
    table: string,
    limit: number,
  ) => Promise<{ columns: string[]; rows: Record<string, unknown>[] }>
  fetchAllTables: (pool: ConnectionPool, limit: number) => Promise<TableRows[]>
  fetchUtilizadores: (pool: ConnectionPool) => Promise<import('../types.js').UtilizadorRow[]>
  createUtilizador: (pool: ConnectionPool, userId: string, userName: string, admin: boolean, obs: string | null) => Promise<import('../types.js').UtilizadorRow>
}

export function createAdminRouter(dependencies: AdminDependencies): Router {
  const router = Router()

  router.get('/api/admin/users', async (request, response) => {
    try {
      requireAdmin(request)
      const connection = dependencies.resolveProfile('orders')
      const users = await withPool(dependencies.openPool, connection, dependencies.fetchUtilizadores)
      const payload: OkUtilizadores = { ok: true, users }
      response.json(payload)
    } catch (error) { sendError(response, error) }
  })

  router.post('/api/admin/users', async (request, response) => {
    try {
      requireAdmin(request)
      const body = utilizadorCreateBodySchema.parse(request.body)
      const connection = dependencies.resolveProfile('orders')
      const user = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.createUtilizador(pool, body.ID_User, body.User_Name, body.Admin, body.Obs ?? null),
      )
      const payload: OkUtilizador = { ok: true, user }
      response.status(201).json(payload)
    } catch (error) { sendError(response, error) }
  })

  router.get('/api/admin/profiles', (_request, response) => {
    try {
      response.json(dependencies.listProfileMetadata())
    } catch (error) {
      sendError(response, error)
    }
  })

  router.post('/api/admin/connect', async (request, response) => {
    await listTablesForConnection(request, response, dependencies, connectBodySchema)
  })

  router.post('/api/admin/tables', async (request, response) => {
    await listTablesForConnection(request, response, dependencies, tablesBodySchema)
  })

  router.post('/api/orders/sync', async (request, response) => {
    try {
      const body = syncBodySchema.parse(request.body)
      const connection = resolveConnection(body, dependencies)
      const result = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.fetchRows(pool, body.schema, body.table, body.limit),
      )
      const payload: OkRows = { ok: true, ...result }
      response.json(payload)
    } catch (error) {
      sendError(response, error)
    }
  })

  router.post('/api/admin/sync-all', async (request, response) => {
    try {
      const body = syncAllBodySchema.parse(request.body)
      const connection = resolveConnection(body, dependencies)
      const tables = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.fetchAllTables(pool, body.limit),
      )
      const payload: OkAllTables = { ok: true, tables }
      response.json(payload)
    } catch (error) {
      sendError(response, error)
    }
  })

  return router
}

function requireAdmin(request: Request): void {
  const role = request.headers['x-user-role']
  if (role !== 'admin') throw new RouteError('forbidden', 403, 'Administrator permission is required.')
}

async function listTablesForConnection(
  request: Request,
  response: Response,
  dependencies: AdminDependencies,
  schema: typeof connectBodySchema,
): Promise<void> {
  try {
    const body = schema.parse(request.body)
    const connection = resolveConnection(body, dependencies)
    const tables = await withPool(dependencies.openPool, connection, dependencies.listTables)
    const payload: OkTables = { ok: true, tables }
    response.json(payload)
  } catch (error) {
    sendError(response, error)
  }
}

function resolveConnection(
  source: ConnectBody | SyncBody | SyncAllBody,
  dependencies: AdminDependencies,
): ConnectionConfig {
  if (source.profileId !== undefined) {
    logger.info('connecting via managed profile', { profileId: source.profileId })
    return dependencies.resolveProfile(source.profileId)
  }
  if (source.credentials !== undefined) {
    if (!dependencies.allowAdHocConnections) throw new AdHocConnectionsDisabledError()
    const { password: _omit, ...target } = source.credentials
    logger.info('connecting via ad-hoc credentials', { ...target })
    return {
      ...source.credentials,
      trustServerCertificate: dependencies.adHocTrustServerCertificate,
    }
  }
  throw new ProfileConfigurationError('No connection source was supplied.')
}
