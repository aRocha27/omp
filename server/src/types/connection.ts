/**
 * Connection / admin wire types.
 *
 * Mirrored by `app/src/domain/models/database-connection-profile.ts`
 * (same repo, same language, kept in sync). A workspace shared-package is
 * overkill for one type.
 */

export type NetworkMode = 'lan' | 'private-remote' | 'cloud'

export type DatabaseConnectionProfile = {
  id: string
  name: string
  networkMode: NetworkMode
  server?: string
  port?: number
  database?: string
  user?: string
  schema?: string
  table?: string
  // NOTE: no `password` here — profile metadata never holds the secret.
  // Password is either ephemeral (ad-hoc, in request body) or in the backend
  // secret store (profile env vars now, Azure Key Vault later).
}

// Connection config used to open an mssql pool. The password only ever lives
// here, in memory, for the duration of one request.
export type ConnectionConfig = {
  server: string
  port: number
  database?: string
  user: string
  password: string
  /** Defaults to true; backend-managed profiles can override for their SQL Server. */
  encrypt?: boolean
  /** Defaults to false so SQL Server certificates are validated unless explicitly overridden. */
  trustServerCertificate?: boolean
}

export type TableInfo = {
  schema: string
  name: string
  type: string
}

export type OkTables = {
  ok: true
  tables: TableInfo[]
}

export type OkRows = {
  ok: true
  columns: string[]
  rows: Record<string, unknown>[]
}

export type TableRows = {
  schema: string
  name: string
  columns: string[]
  rows: Record<string, unknown>[]
}

export type OkAllTables = {
  ok: true
  tables: TableRows[]
}

export type Err = {
  ok: false
  code: ApiErrorCode
  message: string
}

export type ErrorCode = 'login-failed' | 'timeout' | 'unreachable' | 'permission' | 'unknown'
export type ApiErrorCode =
  | ErrorCode
  | 'validation'
  | 'profile'
  | 'table-not-available'
  | 'ad-hoc-disabled'
  | 'unauthorized'
  | 'orders-not-configured'
  | 'forbidden'
  | 'field-locked'
  | 'not-found'
  | 'capacity-exceeded'

export type ProfileMetadata = {
  id: string
  name: string
  networkMode: NetworkMode
  active?: boolean
  server: string
  port: number
  database?: string
  user: string
}
