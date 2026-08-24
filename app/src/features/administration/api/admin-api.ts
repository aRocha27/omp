import { env } from '@/app/configuration/env'
import type { NetworkMode } from '@/domain/models/database-connection-profile'
import { logError, logInfo, logWarn } from '@/features/administration/lib/log'

export interface DatabaseCredentials {
  server: string
  port: number
  database?: string
  user: string
  password: string
}

export type ConnectionSource = { credentials: DatabaseCredentials } | { profileId: string }

export interface BackendProfileMetadata {
  id: string
  name: string
  networkMode: NetworkMode
}

export interface DatabaseTable {
  schema: string
  name: string
  type: string
}

export interface TablesResult {
  ok: true
  tables: DatabaseTable[]
}

export interface SyncResult {
  ok: true
  columns: string[]
  rows: Record<string, unknown>[]
}

export interface SyncedTable {
  schema: string
  name: string
  columns: string[]
  rows: Record<string, unknown>[]
}

export interface SyncAllResult {
  ok: true
  tables: SyncedTable[]
}

export interface ApplicationUser {
  ID_User: string
  User_Name: string | null
  Read_Only: boolean | null
  Admin: boolean | null
  DT_Criacao: string | null
  Cancelado: boolean | null
  DT_Cancelado: string | null
  Obs: string | null
}

interface ApiFailure {
  ok: false
  code: string
  message: string
}

export async function listProfiles(adminToken?: string): Promise<BackendProfileMetadata[]> {
  const data = await getJson('/admin/profiles', adminToken)
  if (!Array.isArray(data) || !data.every(isProfileMetadata)) {
    throw new Error('The server returned invalid connection profile data.')
  }
  return data
}

export async function listApplicationUsers(role: string): Promise<ApplicationUser[]> {
  const data = await getJson('/admin/users', undefined, role)
  if (!isRecord(data) || data.ok !== true || !Array.isArray(data.users)) throw new Error('The server returned invalid user data.')
  return data.users as ApplicationUser[]
}

export async function createApplicationUser(input: { ID_User: string; User_Name: string; Admin: boolean; Obs?: string | null }, role: string): Promise<ApplicationUser> {
  const data = await postJson('/admin/users', input, undefined, role)
  if (!isRecord(data) || data.ok !== true || !isRecord(data.user)) throw new Error('The server returned invalid user data.')
  return data.user as unknown as ApplicationUser
}

export async function connect(
  source: ConnectionSource,
  adminToken?: string,
): Promise<TablesResult> {
  return postTables('/admin/connect', source, adminToken)
}

export async function listTables(
  source: ConnectionSource,
  adminToken?: string,
): Promise<TablesResult> {
  return postTables('/admin/tables', source, adminToken)
}

export async function syncOrders(
  input: {
    source: ConnectionSource
    schema: string
    table: string
    limit?: number
  },
  adminToken?: string,
): Promise<SyncResult> {
  const data = await postJson(
    '/orders/sync',
    {
      ...input.source,
      schema: input.schema,
      table: input.table,
      limit: input.limit ?? 200,
    },
    adminToken,
  )
  if (!isSyncResult(data)) throw new Error('The server returned invalid order data.')
  return data
}

export async function syncAllTables(
  input: { source: ConnectionSource; limit?: number },
  adminToken?: string,
): Promise<SyncAllResult> {
  const data = await postJson(
    '/admin/sync-all',
    { ...input.source, limit: input.limit ?? 200 },
    adminToken,
  )
  if (!isSyncAllResult(data)) throw new Error('The server returned invalid table data.')
  return data
}

async function postTables(
  path: string,
  source: ConnectionSource,
  adminToken?: string,
): Promise<TablesResult> {
  const data = await postJson(path, source, adminToken)
  if (!isTablesResult(data)) throw new Error('The server returned invalid table data.')
  return data
}

async function getJson(path: string, adminToken?: string, role?: string): Promise<unknown> {
  return requestJson(path, {
    headers: requestHeaders({ Accept: 'application/json' }, adminToken, role),
  })
}

async function postJson(path: string, body: unknown, adminToken?: string, role?: string): Promise<unknown> {
  return requestJson(path, {
    method: 'POST',
    headers: requestHeaders(
      { Accept: 'application/json', 'Content-Type': 'application/json' },
      adminToken,
      role,
    ),
    body: JSON.stringify(body),
  })
}

function requestHeaders(base: Record<string, string>, adminToken?: string, role?: string): Record<string, string> {
  const token = adminToken?.trim()
  return { ...base, ...(role ? { 'X-User-Role': role } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

async function requestJson(path: string, init: RequestInit): Promise<unknown> {
  const method = init.method ?? 'GET'
  const hasToken = Boolean((init.headers as Record<string, string> | undefined)?.Authorization)
  logInfo('→', method, path, hasToken ? 'with admin token' : 'no admin token')
  let response: Response
  try {
    response = await fetch(apiUrl(path), init)
  } catch (error) {
    logError('✗ network error reaching', path, error instanceof Error ? error.message : error)
    throw new Error('Couldn’t reach the database service. Check that the Node API is running.', {
      cause: error,
    })
  }

  logInfo('←', method, path, response.status)
  const data = await parseJson(response)
  if (!response.ok || isApiFailure(data)) {
    const message = isApiFailure(data) ? data.message : 'The database service returned an unexpected error.'
    if (isApiFailure(data)) logWarn('✗ API error', path, data.code, data.message)
    throw new Error(message)
  }
  return data
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown
  } catch {
    return null
  }
}

function apiUrl(path: string): string {
  return `${env.apiBaseUrl.replace(/\/$/, '')}${path}`
}

function isApiFailure(value: unknown): value is ApiFailure {
  if (!isRecord(value)) return false
  return value.ok === false && typeof value.code === 'string' && typeof value.message === 'string'
}

function isProfileMetadata(value: unknown): value is BackendProfileMetadata {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isNetworkMode(value.networkMode)
  )
}

function isTablesResult(value: unknown): value is TablesResult {
  if (!isRecord(value) || value.ok !== true || !Array.isArray(value.tables)) return false
  return value.tables.every(
    (table) =>
      isRecord(table) &&
      typeof table.schema === 'string' &&
      typeof table.name === 'string' &&
      typeof table.type === 'string',
  )
}

function isSyncResult(value: unknown): value is SyncResult {
  if (!isRecord(value) || value.ok !== true) return false
  return (
    Array.isArray(value.columns) &&
    value.columns.every((column) => typeof column === 'string') &&
    Array.isArray(value.rows) &&
    value.rows.every(isRecord)
  )
}

function isSyncAllResult(value: unknown): value is SyncAllResult {
  if (!isRecord(value) || value.ok !== true || !Array.isArray(value.tables)) return false
  return value.tables.every(
    (table) =>
      isRecord(table) &&
      typeof table.schema === 'string' &&
      typeof table.name === 'string' &&
      Array.isArray(table.columns) &&
      table.columns.every((column) => typeof column === 'string') &&
      Array.isArray(table.rows) &&
      table.rows.every(isRecord),
  )
}

function isNetworkMode(value: unknown): value is NetworkMode {
  return value === 'lan' || value === 'private-remote' || value === 'cloud'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
