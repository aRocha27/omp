import { createRequire } from 'node:module'
import type { config as SqlConfig, ConnectionPool } from 'mssql'
import { logger } from '../logger.js'
import type { ConnectionConfig, TableInfo, TableRows } from '../types.js'

// `mssql` ships as CommonJS. Under Node ESM the named exports (ConnectionPool,
// Int, ...) are not exposed on the namespace — they live on the CJS
// module.exports object. createRequire loads that object directly while the
// `typeof import(...)` cast preserves the package's TypeScript types.
const mssql = createRequire(import.meta.url)('mssql') as typeof import('mssql')

const CONNECTION_TIMEOUT_MS = 10_000
const REQUEST_TIMEOUT_MS = 20_000
export const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_#$]{0,127}$/
export const TABLES_QUERY = `SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
FROM INFORMATION_SCHEMA.TABLES
ORDER BY TABLE_SCHEMA, TABLE_NAME`

type TableMetadataRow = {
  TABLE_SCHEMA: string
  TABLE_NAME: string
  TABLE_TYPE: string
}

export class TableUnavailableError extends Error {
  constructor() {
    super('The selected table is not available for this connection.')
    this.name = 'TableUnavailableError'
  }
}

export function buildSqlConfig(connection: ConnectionConfig): SqlConfig {
  return {
    server: connection.server,
    port: connection.port,
    database: connection.database,
    user: connection.user,
    password: connection.password,
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    requestTimeout: REQUEST_TIMEOUT_MS,
    options: {
      encrypt: connection.encrypt ?? true,
      trustServerCertificate: connection.trustServerCertificate ?? false,
    },
    pool: {
      max: 5,
      min: 0,
      idleTimeoutMillis: 30_000,
    },
  }
}

export async function openPool(connection: ConnectionConfig): Promise<ConnectionPool> {
  logger.info('opening SQL Server connection', {
    server: connection.server,
    port: connection.port,
    database: connection.database ?? null,
    user: connection.user,
    encrypt: connection.encrypt ?? true,
    trustServerCertificate: connection.trustServerCertificate ?? false,
  })
  // A dedicated pool is required because the API may receive different profiles
  // concurrently. mssql's global connect() pool would reuse the first config.
  try {
    const pool = await new mssql.ConnectionPool(buildSqlConfig(connection)).connect()
    logger.info('SQL Server connection established', {
      server: connection.server,
      port: connection.port,
      database: connection.database ?? null,
    })
    return pool
  } catch (error) {
    // The raw error may echo credentials; only its name/class is safe to log.
    logger.error('SQL Server connection failed', {
      server: connection.server,
      port: connection.port,
      database: connection.database ?? null,
      errorName: error instanceof Error ? error.name : 'unknown',
    })
    throw error
  }
}

export async function listTables(pool: ConnectionPool): Promise<TableInfo[]> {
  const result = await pool.request().query<TableMetadataRow>(TABLES_QUERY)
  return result.recordset.map((row) => ({
    schema: row.TABLE_SCHEMA,
    name: row.TABLE_NAME,
    type: row.TABLE_TYPE,
  }))
}

export async function fetchRows(
  pool: ConnectionPool,
  schema: string,
  table: string,
  limit: number,
): Promise<{ columns: string[]; rows: Record<string, unknown>[] }> {
  const availableTables = await listTables(pool)
  const selected = availableTables.some((item) => item.schema === schema && item.name === table)

  if (!selected || !IDENTIFIER_PATTERN.test(schema) || !IDENTIFIER_PATTERN.test(table)) {
    throw new TableUnavailableError()
  }

  const request = pool.request()
  request.input('limit', mssql.Int, limit)
  const result = await request.query<Record<string, unknown>>(
    `SELECT TOP (@limit) * FROM [${schema}].[${table}]`,
  )
  const rows = Array.from(result.recordset)
  const columns = Object.keys(result.recordset.columns ?? rows[0] ?? {})

  return { columns, rows }
}

// Fetches rows for every table/view visible to the connection using a single
// pool. Tables that error (permission, type, etc.) are skipped and logged so
// one bad table doesn't fail the whole import.
export async function fetchAllTables(pool: ConnectionPool, limit: number): Promise<TableRows[]> {
  const tables = await listTables(pool)
  const results: TableRows[] = []
  for (const table of tables) {
    try {
      const { columns, rows } = await fetchRows(pool, table.schema, table.name, limit)
      results.push({ schema: table.schema, name: table.name, columns, rows })
    } catch (error) {
      logger.warn('skipped table during sync-all', {
        schema: table.schema,
        table: table.name,
        errorName: error instanceof Error ? error.name : 'unknown',
      })
    }
  }
  return results
}
