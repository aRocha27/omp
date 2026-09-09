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
  masterDataTableSchema,
  masterDataCreateBodySchema,
  masterDataDeleteBodySchema,
  masterDataUpdateBodySchema,
  databaseSelectionBodySchema,
} from '../validation.js'
import { AdHocConnectionsDisabledError, RouteError, sendError, withPool } from './http-errors.js'
import { setDatabaseSelection } from '../database-selection.js'

export interface AdminDependencies {
  allowAdHocConnections: boolean
  adHocTrustServerCertificate: boolean
  listProfileMetadata: () => ProfileMetadata[]
  resolveProfile: (profileId: string) => ConnectionConfig
  resolveOrdersProfile?: () => ConnectionConfig
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
  createUtilizador: (
    pool: ConnectionPool,
    userId: string,
    userName: string,
    admin: boolean,
    obs: string | null,
  ) => Promise<import('../types.js').UtilizadorRow>
  fetchMasterData: (
    pool: ConnectionPool,
    table: string,
    limit?: number,
  ) => Promise<{ columns: string[]; rows: Record<string, unknown>[] }>
  createMasterData: (
    pool: ConnectionPool,
    table: string,
    values: Record<string, string | number | boolean | null>,
  ) => Promise<{ columns: string[]; rows: Record<string, unknown>[] }>
  deleteMasterData: (
    pool: ConnectionPool,
    table: string,
    key: string,
    value: string | number,
  ) => Promise<void>
  updateMasterData: (
    pool: ConnectionPool,
    table: string,
    key: string,
    value: string | number,
    values: Record<string, string | number | boolean | null>,
  ) => Promise<{ columns: string[]; rows: Record<string, unknown>[] }>
  fetchStock?: (
    pool: ConnectionPool,
    filters: { ref?: string; warehouse?: string; description?: string },
  ) => Promise<{ columns: string[]; rows: Record<string, unknown>[] }>
  fetchStockMovements?: (
    pool: ConnectionPool,
  ) => Promise<{ columns: string[]; rows: Record<string, unknown>[] }>
  createStockMovement?: (
    pool: ConnectionPool,
    values: {
      ref: string
      id_arm: number
      mov_date: string
      mov_description: string | null
      mov_qt: number
    },
  ) => Promise<number | undefined>
}

export function createAdminRouter(dependencies: AdminDependencies): Router {
  const router = Router()

  router.get('/api/stock', async (request, response) => {
    try {
      requireStockUser(request)
      if (!dependencies.fetchStock) throw new RouteError('unknown', 501, 'Stock is not configured.')
      const result = await withPool(
        dependencies.openPool,
        resolveAdminConnection(dependencies),
        (pool) =>
          dependencies.fetchStock!(pool, {
            ref: stringQuery(request.query.ref),
            warehouse: stringQuery(request.query.warehouse),
            description: stringQuery(request.query.description),
          }),
      )
      response.json({ ok: true, ...result })
    } catch (error) {
      sendError(response, error)
    }
  })

  router.get('/api/stock/movements', async (_request, response) => {
    try {
      requireStockUser(_request)
      if (!dependencies.fetchStockMovements)
        throw new RouteError('unknown', 501, 'Stock is not configured.')
      const result = await withPool(
        dependencies.openPool,
        resolveAdminConnection(dependencies),
        dependencies.fetchStockMovements,
      )
      response.json({ ok: true, ...result })
    } catch (error) {
      sendError(response, error)
    }
  })

  router.post('/api/stock/movements', async (request, response) => {
    try {
      requireStockUser(request)
      const body = request.body as Record<string, unknown>
      const ref = body.ref
      const quantity = body.mov_qt
      if (
        !dependencies.createStockMovement ||
        typeof ref !== 'string' ||
        !ref.trim() ||
        !Number.isInteger(body.id_arm) ||
        typeof body.mov_date !== 'string' ||
        !Number.isFinite(Date.parse(body.mov_date)) ||
        typeof quantity !== 'number' ||
        !Number.isFinite(quantity)
      )
        throw new RouteError('validation', 400, 'Invalid stock movement.')
      const id = await withPool(
        dependencies.openPool,
        resolveAdminConnection(dependencies),
        (pool) =>
          dependencies.createStockMovement!(pool, {
            ref: ref.trim(),
            id_arm: body.id_arm as number,
            mov_date: body.mov_date as string,
            mov_description: typeof body.mov_description === 'string' ? body.mov_description : null,
            mov_qt: quantity,
          }),
      )
      response.status(201).json({ ok: true, id })
    } catch (error) {
      sendError(response, error)
    }
  })

  router.get('/api/admin/users', async (request, response) => {
    try {
      requireAdmin(request)
      const connection = resolveAdminConnection(dependencies)
      const users = await withPool(
        dependencies.openPool,
        connection,
        dependencies.fetchUtilizadores,
      )
      const payload: OkUtilizadores = { ok: true, users }
      response.json(payload)
    } catch (error) {
      sendError(response, error)
    }
  })

  router.get('/api/admin/master-data/:table', async (request, response) => {
    try {
      const table = masterDataTableSchema.parse(request.params.table)
      if (table === 'stck_Armazens') requireStockUser(request)
      else requireAdmin(request)
      const source = request.query.profileId ? { profileId: String(request.query.profileId) } : {}
      const result = await withPool(
        dependencies.openPool,
        resolveAdminConnection(dependencies, source),
        (pool) => dependencies.fetchMasterData(pool, table, table === 'stck_Materiais' ? 25000 : undefined),
      )
      response.json({ ok: true, ...result })
    } catch (error) {
      sendError(response, error)
    }
  })
  router.get('/api/company-identification', async (_request, response) => {
    try {
      requireAdmin(_request)
      const result = await withPool(
        dependencies.openPool,
        resolveAdminConnection(dependencies),
        (pool) => dependencies.fetchMasterData(pool, 'Identificacao', 1),
      )
      response.json({ ok: true, ...result })
    } catch (error) {
      sendError(response, error)
    }
  })
  router.post('/api/admin/master-data', async (request, response) => {
    try {
      requireAdmin(request)
      const body = masterDataCreateBodySchema.parse(request.body)
      const result = await withPool(
        dependencies.openPool,
        resolveAdminConnection(dependencies, body),
        (pool) => dependencies.createMasterData(pool, body.table, body.values),
      )
      response.status(201).json({ ok: true, ...result })
    } catch (error) {
      sendError(response, error)
    }
  })
  router.delete('/api/admin/master-data', async (request, response) => {
    try {
      requireAdmin(request)
      const body = masterDataDeleteBodySchema.parse(request.body)
      await withPool(dependencies.openPool, resolveAdminConnection(dependencies, body), (pool) =>
        dependencies.deleteMasterData(pool, body.table, body.key, body.value),
      )
      response.json({ ok: true })
    } catch (error) {
      sendError(response, error)
    }
  })
  router.put('/api/admin/master-data', async (request, response) => {
    try {
      requireAdmin(request)
      const body = masterDataUpdateBodySchema.parse(request.body)
      const result = await withPool(
        dependencies.openPool,
        resolveAdminConnection(dependencies, body),
        (pool) =>
          dependencies.updateMasterData(pool, body.table, body.key, body.value, body.values),
      )
      response.json({ ok: true, ...result })
    } catch (error) {
      sendError(response, error)
    }
  })

  router.post('/api/admin/users', async (request, response) => {
    try {
      requireAdmin(request)
      const body = utilizadorCreateBodySchema.parse(request.body)
      const connection = resolveAdminConnection(dependencies)
      const user = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.createUtilizador(
          pool,
          body.ID_User,
          body.User_Name,
          body.Admin,
          body.Obs ?? null,
        ),
      )
      const payload: OkUtilizador = { ok: true, user }
      response.status(201).json(payload)
    } catch (error) {
      sendError(response, error)
    }
  })

  router.get('/api/admin/profiles', (_request, response) => {
    try {
      requireAdmin(_request)
      response.json(dependencies.listProfileMetadata())
    } catch (error) {
      sendError(response, error)
    }
  })

  router.post('/api/admin/connect', async (request, response) => {
    await listTablesForConnection(request, response, dependencies, connectBodySchema)
  })

  router.post('/api/admin/database-selection', async (request, response) => {
    try {
      requireAdmin(request)
      const body = databaseSelectionBodySchema.parse(request.body)
      const connection = resolveConnection(body, dependencies)
      await withPool(dependencies.openPool, connection, dependencies.listTables)
      const token = setDatabaseSelection(connection, body.scope, body.profileId, body.profileName)
      response.json({ ok: true, scope: body.scope, selectionToken: token })
      if (body.scope === 'global' && process.env.NODE_ENV === 'production') {
        setTimeout(() => process.exit(0), 100)
      }
    } catch (error) {
      sendError(response, error)
    }
  })

  router.post('/api/admin/tables', async (request, response) => {
    await listTablesForConnection(request, response, dependencies, tablesBodySchema)
  })

  router.post('/api/orders/sync', async (request, response) => {
    try {
      requireAdmin(request)
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
      requireAdmin(request)
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
  if (process.env.NODE_ENV === 'test' && role === undefined) return
  if (role !== 'admin')
    throw new RouteError('forbidden', 403, 'Administrator permission is required.')
}

function requireStockUser(request: Request): void {
  const role = request.headers['x-user-role']
  if (role !== 'user' && role !== 'editor' && role !== 'admin')
    throw new RouteError('forbidden', 403, 'Stock edit permission is required.')
}

function stringQuery(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function resolveAdminConnection(
  dependencies: AdminDependencies,
  source?: {
    profileId?: string
    credentials?: ConnectionConfig
  },
): ConnectionConfig {
  if (source?.profileId) return dependencies.resolveProfile(source.profileId)
  if (source?.credentials) {
    if (!dependencies.allowAdHocConnections) throw new AdHocConnectionsDisabledError()
    return {
      ...source.credentials,
      trustServerCertificate: dependencies.adHocTrustServerCertificate,
    }
  }
  return dependencies.resolveOrdersProfile?.() ?? dependencies.resolveProfile('orders')
}

async function listTablesForConnection(
  request: Request,
  response: Response,
  dependencies: AdminDependencies,
  schema: typeof connectBodySchema,
): Promise<void> {
  try {
    requireAdmin(request)
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
