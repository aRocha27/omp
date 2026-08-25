import { createRequire } from 'node:module'
import type { config as SqlConfig, ConnectionPool, ISqlType } from 'mssql'
import { logger } from './logger.js'
import type {
  ClientDetailRow,
  ClientSummaryRow,
  ConnectionConfig,
  DocumentoFaturacaoRow,
  DocumentoFaturacaoTypeRow,
  OrderDetailRow,
  OrderCreateInput,
  OrderSummaryRow,
  OrderUpdateChanges,
  ReconhecimentoRow,
  NewReconhecimentoInput,
  NewFacturacaoInput,
  ReconhecimentoPatch,
  FacturacaoPatch,
  PropagateReconhecimentoInput,
  UtilizadorRow,
  TableInfo,
  TableRows,
} from './types.js'

// `mssql` ships as CommonJS. Under Node ESM the named exports (ConnectionPool,
// Int, ...) are not exposed on the namespace — they live on the CJS
// module.exports object. createRequire loads that object directly while the
// `typeof import(...)` cast preserves the package's TypeScript types.
const mssql = createRequire(import.meta.url)('mssql') as typeof import('mssql')

const CONNECTION_TIMEOUT_MS = 10_000
const REQUEST_TIMEOUT_MS = 20_000
const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_#$]{0,127}$/
const TABLES_QUERY = `SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
FROM INFORMATION_SCHEMA.TABLES
ORDER BY TABLE_SCHEMA, TABLE_NAME`

// Orders read-path targets are hardcoded — they are never taken from the request, so
// there is no injection surface and no need for the INFORMATION_SCHEMA availability check.
// Verified against BRKR_ERP 2026-08-23.
const ORDERS_SCHEMA = 'dbo'
const ORDERS_VIEW = 'V_Order_List'
const ORDERS_TABLE = 'Order'
const CLIENT_TABLE = 'Client'
const RECONHECIMENTO_TABLE = 'Reconhecimento'
const FACTURACAO_TABLE = 'Facturacao'
const MONEY_EPSILON = 0.00005
const PROPAGATION_CHUNK_SIZE = 500

const RECONHECIMENTO_UPDATEABLE_COLUMNS: ReadonlyArray<{
  column: keyof ReconhecimentoPatch
  type: ISqlType | (() => ISqlType)
}> = [
  { column: 'ID_Tp_Reconhecimento', type: mssql.NVarChar },
  { column: 'DT_Reconhecimento', type: mssql.DateTime },
  { column: 'Valor_Reconhecimento', type: mssql.Money },
]

const FACTURACAO_UPDATEABLE_COLUMNS: ReadonlyArray<{
  column: keyof FacturacaoPatch
  type: ISqlType | (() => ISqlType)
}> = [
  { column: 'DT_Doc_FT', type: mssql.DateTime },
  { column: 'ID_Tp_Doc_FT', type: mssql.NVarChar },
  { column: 'N_Doc_FT', type: mssql.NVarChar },
  { column: 'Valor_Doc_FT', type: mssql.Money },
]

// Hardcoded whitelist of dbo.[Order] columns an editor may UPDATE. Column names are
// constants (never user input), so building the SET clause from this list is safe by
// construction — there is no injection surface. Each entry pairs the column with its
// mssql bind type so the parameterized UPDATE uses the right SQL Server type. Keep the
// keys in sync with OrderUpdatePatch in types.ts.
const UPDATEABLE_COLUMNS: ReadonlyArray<{ column: string; type: ISqlType | (() => ISqlType) }> = [
  { column: 'DT_Order', type: mssql.DateTime },
  { column: 'ID_Tp_Order', type: mssql.NVarChar },
  { column: 'Encomenda_Cli_PHC', type: mssql.NVarChar },
  { column: 'ID_Client', type: mssql.Int },
  { column: 'ID_Area', type: mssql.NVarChar },
  { column: 'ID_Tipo', type: mssql.NVarChar },
  { column: 'ID_Produto', type: mssql.Int },
  { column: 'ID_Instrumento', type: mssql.Int },
  { column: 'Orc_Proposta', type: mssql.NVarChar },
  { column: 'PO_Cliente', type: mssql.NVarChar },
  { column: 'Sell_Price', type: mssql.Money },
  { column: 'ID_Tp_Warranty', type: mssql.Int },
  { column: 'Warranty_Reserve', type: mssql.Money },
  { column: 'Warranty_DT_Inicio', type: mssql.DateTime },
  { column: 'ID_Tp_Revenue', type: mssql.Int },
  { column: 'Facturado', type: mssql.Bit },
  { column: 'Reconhecido', type: mssql.Bit },
  { column: 'Cod_Enc_Fornecedor', type: mssql.NVarChar },
  { column: 'Obs', type: mssql.NVarChar },
  { column: 'Negocio_Fechado', type: mssql.Bit },
  { column: 'Kit', type: mssql.Bit },
  { column: 'Kit_Amount', type: mssql.Int },
]

// Caracterização fields locked once the order's month is closed (non-provisional only).
// Editors cannot touch these on a histórico order; admins always can. Provisional orders
// are always editable. Used by the route's defense-in-depth check.
const LOCKED_CARACTERIZACAO_FIELDS = new Set([
  'DT_Order',
  'ID_Tp_Order',
  'ID_Client',
  'ID_Area',
  'ID_Tipo',
  'ID_Produto',
  'ID_Instrumento',
  'Sell_Price',
  'ID_Tp_Warranty',
  'Warranty_Reserve',
  'Warranty_DT_Inicio',
])

/** Orders list filters as they arrive from the validated request body. */
export type OrderListFilters = {
  dateFrom?: string
  dateTo?: string
  clientName?: string
  orderFactory?: boolean
  idTpOrder?: string[]
  idArea?: string[]
  idTipo?: string[]
  idProduto?: number[]
  idInstrumento?: number[]
  encomendaCliPHC?: string
  negocioFechado?: boolean
}

type TableMetadataRow = {
  TABLE_SCHEMA: string
  TABLE_NAME: string
  TABLE_TYPE: string
}

/** Clients list filters as they arrive from the validated request body. */
export type ClientListFilters = {
  search?: string
  idTpCliente?: number[]
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

// Orders list. Reads from V_Order_List so the client name (`nome`) and label columns are
// already joined. Only the OrderSummary fields are projected; `nome` is aliased to
// `Client_Name`. Filters are bound as parameters (never interpolated) and the WHERE is
// built from the non-empty filters only. Ordering matches the mock: DT_Order DESC, then
// ID_Order DESC.
export async function fetchOrderSummaries(
  pool: ConnectionPool,
  filters: OrderListFilters,
  limit: number,
): Promise<OrderSummaryRow[]> {
  const request = pool.request()
  const where: string[] = []

  if (filters.dateFrom) {
    where.push('DT_Order >= @dateFrom')
    request.input('dateFrom', mssql.NVarChar, filters.dateFrom)
  }
  if (filters.dateTo) {
    // Half-open upper bound: an inclusive `dateTo` of "2025-09-12" must cover rows at
    // 2025-09-12 14:00. A bare `<=` on a datetime would drop them. DATEADD runs server-side.
    where.push('DT_Order < DATEADD(day, 1, @dateTo)')
    request.input('dateTo', mssql.NVarChar, filters.dateTo)
  }
  if (filters.clientName) {
    where.push('nome LIKE @clientName')
    request.input('clientName', mssql.NVarChar, `%${filters.clientName}%`)
  }
  if (filters.orderFactory !== undefined) {
    where.push('Order_Factory = @orderFactory')
    request.input('orderFactory', mssql.Bit, filters.orderFactory)
  }
  if (filters.negocioFechado !== undefined) {
    where.push('Negocio_Fechado = @negocioFechado')
    request.input('negocioFechado', mssql.Bit, filters.negocioFechado)
  }
  // Categorical multi-select filters expand to parameterized `IN (@p0, @p1, …)`.
  // Values are bound as parameters (never interpolated into the SQL), so there is no
  // injection surface; only the placeholder count is dynamic. SQL Server has a hard
  // limit of 2100 parameters per query — the frontend reference-data sets are far below
  // that (instrumentos is the largest at 70).
  if (filters.idTpOrder && filters.idTpOrder.length > 0) {
    where.push(`ID_Tp_Order IN (${placeholders('idTpOrder', filters.idTpOrder.length)})`)
    filters.idTpOrder.forEach((value, index) => {
      request.input(`idTpOrder${index}`, mssql.NVarChar, value)
    })
  }
  if (filters.idArea && filters.idArea.length > 0) {
    where.push(`ID_Area IN (${placeholders('idArea', filters.idArea.length)})`)
    filters.idArea.forEach((value, index) => {
      request.input(`idArea${index}`, mssql.NVarChar, value)
    })
  }
  if (filters.idTipo && filters.idTipo.length > 0) {
    where.push(`ID_Tipo IN (${placeholders('idTipo', filters.idTipo.length)})`)
    filters.idTipo.forEach((value, index) => {
      request.input(`idTipo${index}`, mssql.NVarChar, value)
    })
  }
  if (filters.idProduto && filters.idProduto.length > 0) {
    where.push(`ID_Produto IN (${placeholders('idProduto', filters.idProduto.length)})`)
    filters.idProduto.forEach((value, index) => {
      request.input(`idProduto${index}`, mssql.Int, value)
    })
  }
  if (filters.idInstrumento && filters.idInstrumento.length > 0) {
    where.push(`ID_Instrumento IN (${placeholders('idInstrumento', filters.idInstrumento.length)})`)
    filters.idInstrumento.forEach((value, index) => {
      request.input(`idInstrumento${index}`, mssql.Int, value)
    })
  }
  if (filters.encomendaCliPHC) {
    where.push('Encomenda_Cli_PHC LIKE @encomendaCliPHC')
    request.input('encomendaCliPHC', mssql.NVarChar, `%${filters.encomendaCliPHC}%`)
  }

  request.input('limit', mssql.Int, limit)
  const sql = `SELECT TOP (@limit)
    ID_Order, DT_Order, Order_Factory, ID_Tp_Order, ID_Client,
    nome AS Client_Name, ID_Area, ID_Tipo, ID_Produto, ID_Instrumento,
    Sell_Price, Negocio_Fechado, Encomenda_Cli_PHC, Provisoria
  FROM [${ORDERS_SCHEMA}].[${ORDERS_VIEW}]
  ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
  ORDER BY DT_Order DESC, ID_Order DESC`

  const result = await request.query<Record<string, unknown>>(sql)
  return Array.from(result.recordset).map(toSummaryRow)
}

// Order detail. The base Order table has every field but no client name or labels, so we
// LEFT JOIN Client (on Order.ID_Client = Client.ID_Cliente) for `nome`/`contacto`. The
// view's label columns are not needed here — the frontend resolves labels client-side
// from the reconciled reference-data fixtures. `upsize_ts` (rowversion Buffer) is dropped.
// Returns null when no row matches; callers map that to the not-found contract.
export async function fetchOrderById(
  pool: ConnectionPool,
  id: number,
): Promise<OrderDetailRow | null> {
  const request = pool.request()
  request.input('id', mssql.Int, id)
  // The base Order table has no Provisoria column — it lives only on V_Order_List. We LEFT
  // JOIN the view (keyed by ID_Order) so a row present in [Order] but missing from the view
  // still resolves with Provisoria NULL rather than dropping the whole detail.
  const sql = `SELECT
    o.ID_Order, o.DT_Order, o.Order_Factory, o.ID_Tp_Order, o.ID_Client,
    c.nome AS Client_Name, o.ID_Area, o.ID_Tipo, t.Warranty AS Tipo_Warranty,
    o.ID_Produto, o.ID_Instrumento,
    o.Orc_Proposta, o.PO_Cliente, o.Sell_Price, o.ID_Tp_Warranty,
    o.Warranty_Reserve, o.Warranty_DT_Inicio, o.ID_Tp_Revenue, o.Facturado,
    o.Reconhecido, o.Cod_Enc_Fornecedor, o.Obs, o.Negocio_Fechado, o.ID_User,
    o.DT_User, o.Kit, o.Kit_Amount, c.contacto AS Contacto, v.Provisoria AS Provisoria
  FROM [${ORDERS_SCHEMA}].[${ORDERS_TABLE}] AS o
  LEFT JOIN [${ORDERS_SCHEMA}].[${CLIENT_TABLE}] AS c ON o.ID_Client = c.ID_Cliente
  LEFT JOIN [${ORDERS_SCHEMA}].[Tipo] AS t ON o.ID_Tipo = t.ID_Tipo
  LEFT JOIN [${ORDERS_SCHEMA}].[${ORDERS_VIEW}] AS v ON v.ID_Order = o.ID_Order
  WHERE o.ID_Order = @id`

  const result = await request.query<Record<string, unknown>>(sql)
  if (result.recordset.length === 0) return null
  return toDetailRow(result.recordset[0])
}

// Applies a partial UPDATE to dbo.[Order]. The SET clause is built ONLY from columns in
// the hardcoded UPDATEABLE_COLUMNS whitelist that are present in `changes` — column names
// are constants, never interpolated from input. Every update stamps ID_User and DT_User
// (GETUTCDATE()) for audit. Returns the re-read row, or null when the UPDATE affected 0
// rows (the id was not found or soft-deleted). The route enforces who may call this; the
// db layer just persists what it is given.
export async function updateOrder(
  pool: ConnectionPool,
  id: number,
  changes: OrderUpdateChanges,
): Promise<OrderDetailRow | null> {
  if (
    'Sell_Price' in changes ||
    'Warranty_Reserve' in changes ||
    'ID_Tipo' in changes
  ) {
    return updateOrderWithCapacityValidation(pool, id, changes)
  }

  const setClauses: string[] = []
  const request = pool.request()
  request.input('id', mssql.Int, id)
  request.input('user', mssql.NVarChar, changes.user)

  for (const { column, type } of UPDATEABLE_COLUMNS) {
    if (column in changes) {
      setClauses.push(`${column} = @${column}`)
      request.input(column, type, (changes as Record<string, unknown>)[column])
    }
  }
  // Always stamp the audit columns — an update with no other changes still records who
  // touched the row and when (UTC, per TIMEZONE.md).
  setClauses.push('ID_User = @user')
  setClauses.push('DT_User = GETUTCDATE()')

  const sql = `UPDATE [${ORDERS_SCHEMA}].[${ORDERS_TABLE}]
    SET ${setClauses.join(', ')}
    WHERE ID_Order = @id`

  const result = await request.query(sql)
  // rowsAffected[0] is the rowcount for the UPDATE statement.
  if (result.rowsAffected[0] === 0) return null
  return fetchOrderById(pool, id)
}

async function updateOrderWithCapacityValidation(
  pool: ConnectionPool,
  id: number,
  changes: OrderUpdateChanges,
): Promise<OrderDetailRow | null> {
  const transaction = pool.transaction()
  await transaction.begin()
  try {
    const setClauses: string[] = []
    const request = transaction.request()
    request.input('id', mssql.Int, id)
    request.input('user', mssql.NVarChar, changes.user)
    for (const { column, type } of UPDATEABLE_COLUMNS) {
      if (column in changes) {
        setClauses.push(`${column} = @${column}`)
        request.input(column, type, (changes as Record<string, unknown>)[column])
      }
    }
    setClauses.push('ID_User = @user')
    setClauses.push('DT_User = GETUTCDATE()')

    const updated = await request.query(
      `UPDATE [${ORDERS_SCHEMA}].[${ORDERS_TABLE}]
       SET ${setClauses.join(', ')}
       WHERE ID_Order = @id`,
    )
    if ((updated.rowsAffected[0] ?? 0) === 0) {
      await transaction.rollback()
      return null
    }

    const order = await lockRecognitionOrder(transaction, id)
    const recognitionRows = await readRecognitionCapacityRows(transaction, id)
    assertExistingRecognitionCapacity(order, recognitionRows)

    const invoicingRows = await readInvoicingCapacityRows(transaction, id)
    assertExistingInvoicingCapacity(order, invoicingRows)

    await transaction.commit()
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }

  return fetchOrderById(pool, id)
}

export async function createOrder(
  pool: ConnectionPool,
  input: OrderCreateInput,
  user: string,
): Promise<OrderDetailRow> {
  const request = pool.request()
  request.input('DT_Order', mssql.DateTime, input.DT_Order)
  request.input('ID_Tp_Order', mssql.NVarChar, input.ID_Tp_Order)
  request.input('ID_Client', mssql.Int, input.ID_Client)
  request.input('user', mssql.NVarChar, user)

  const columns: string[] = ['DT_Order', 'ID_Tp_Order', 'ID_Client', 'ID_User', 'DT_User']
  const values: string[] = ['@DT_Order', '@ID_Tp_Order', '@ID_Client', '@user', 'GETUTCDATE()']
  for (const { column, type } of UPDATEABLE_COLUMNS) {
    if (
      !(column in input) ||
      column === 'DT_Order' ||
      column === 'ID_Tp_Order' ||
      column === 'ID_Client'
    )
      continue
    columns.push(column)
    values.push(`@${column}`)
    request.input(column, type, (input as Record<string, unknown>)[column])
  }
  const result = await request.query<{ ID_Order: number }>(
    `INSERT INTO [${ORDERS_SCHEMA}].[${ORDERS_TABLE}] (${columns.join(', ')})
     OUTPUT INSERTED.ID_Order
     VALUES (${values.join(', ')})`,
  )
  const id = result.recordset[0]?.ID_Order
  if (!id) throw new Error('The database did not return the new order identifier.')
  const created = await fetchOrderById(pool, id)
  if (!created) throw new Error('The new order could not be read after creation.')
  return created
}

// "bloqueio de caracterização após fecho do mês": an order is histórico when its DT_Order
// falls in a strictly earlier month than `today` (year+month compare, UTC). Provisional
// (Provisoria === true) orders are NEVER histórico — they stay editable until finalized.
export function isHistoricoRow(row: OrderDetailRow, today: Date = new Date()): boolean {
  if (row.Provisoria === true) return false
  const orderDate = new Date(row.DT_Order)
  if (Number.isNaN(orderDate.getTime())) return false
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
  return orderDate.getTime() < monthStart.getTime()
}

export function isLockedCaracterizacaoField(field: string): boolean {
  return LOCKED_CARACTERIZACAO_FIELDS.has(field)
}

// Clients list. Reads directly from dbo.Client (no join needed — the summary projection has
// no label). `search` is a case-insensitive contains match across `nome`, the tax number
// (cast to varchar), and the PHC short code (cast to varchar); SQL Server's default collation
// is case-insensitive for LIKE. `idTpCliente` expands to a parameterized IN clause. Filters
// with empty values are omitted by the route before calling, so the db layer only builds
// clauses for present non-empty filters. Ordered by nome ASC, then ID_Cliente ASC, so the
// picker is stable and alphabetical.
export async function fetchClientSummaries(
  pool: ConnectionPool,
  filters: ClientListFilters,
  limit: number,
): Promise<ClientSummaryRow[]> {
  const request = pool.request()
  const where: string[] = []

  if (filters.search) {
    // One parameter reused across the three OR'd LIKE predicates — SQL Server binds by name,
    // so `@search` can appear multiple times in the statement.
    where.push(
      '(nome LIKE @search OR CAST(ncont AS varchar) LIKE @search OR CAST(no_PHC AS varchar) LIKE @search)',
    )
    request.input('search', mssql.NVarChar, `%${filters.search}%`)
  }
  if (filters.idTpCliente && filters.idTpCliente.length > 0) {
    where.push(`ID_Tp_Cliente IN (${placeholders('idTpCliente', filters.idTpCliente.length)})`)
    filters.idTpCliente.forEach((value, index) => {
      request.input(`idTpCliente${index}`, mssql.Int, value)
    })
  }

  request.input('limit', mssql.Int, limit)
  const sql = `SELECT TOP (@limit)
    ID_Cliente, no_PHC, ID_Tp_Cliente, nome, ncont, telefone, local
  FROM [${ORDERS_SCHEMA}].[${CLIENT_TABLE}]
  ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
  ORDER BY nome ASC, ID_Cliente ASC`

  const result = await request.query<Record<string, unknown>>(sql)
  return Array.from(result.recordset).map(toClientSummaryRow)
}

// Client detail. Returns every dbo.Client column except `upsize_ts` (stripped). `Defense`
// (bit) maps to boolean. `ID_Tp_Cliente` is returned raw — the frontend resolves the label.
// Returns null when no row matches; the route maps that to the not-found contract (200 null).
export async function fetchClientById(
  pool: ConnectionPool,
  id: number,
): Promise<ClientDetailRow | null> {
  const request = pool.request()
  request.input('id', mssql.Int, id)
  const sql = `SELECT
    ID_Cliente, no_PHC, ID_Tp_Cliente, nome, ncont, fax, telefone, contacto,
    morada, local, codpost, zona, Defense
  FROM [${ORDERS_SCHEMA}].[${CLIENT_TABLE}]
  WHERE ID_Cliente = @id`

  const result = await request.query<Record<string, unknown>>(sql)
  if (result.recordset.length === 0) return null
  return toClientDetailRow(result.recordset[0])
}

// Order sub-table reads. Both tables are read-only here (no writes). Rows are ordered by PK
// ascending so the detail view is stable. `upsize_ts` is not selected (stripped at the SQL
// layer rather than the mapper — there is no reason to ship the Buffer over the wire at all).
export async function fetchReconhecimentos(
  pool: ConnectionPool,
  orderId: number,
): Promise<ReconhecimentoRow[]> {
  const request = pool.request()
  request.input('orderId', mssql.Int, orderId)
  const sql = `SELECT
    ID_Reconhecimento, ID_Order, ID_Tp_Reconhecimento, DT_Reconhecimento,
    Valor_Reconhecimento, ID_User, DT_User
  FROM [${ORDERS_SCHEMA}].[${RECONHECIMENTO_TABLE}]
  WHERE ID_Order = @orderId
  ORDER BY ID_Reconhecimento ASC`

  const result = await request.query<Record<string, unknown>>(sql)
  return Array.from(result.recordset).map(toReconhecimentoRow)
}

export async function fetchFacturacao(
  pool: ConnectionPool,
  orderId: number,
): Promise<DocumentoFaturacaoRow[]> {
  const request = pool.request()
  request.input('orderId', mssql.Int, orderId)
  const sql = `SELECT
    ID_Facturacao, ID_Order, DT_Doc_FT, ID_Tp_Doc_FT, N_Doc_FT,
    Valor_Doc_FT, ID_User, DT_User
  FROM [${ORDERS_SCHEMA}].[${FACTURACAO_TABLE}]
  WHERE ID_Order = @orderId
  ORDER BY ID_Facturacao ASC`

  const result = await request.query<Record<string, unknown>>(sql)
  return Array.from(result.recordset).map(toFacturacaoRow)
}

export async function fetchFacturacaoTypes(
  pool: ConnectionPool,
): Promise<DocumentoFaturacaoTypeRow[]> {
  const result = await pool.request().query<Record<string, unknown>>(
    `SELECT ID_Tp_Doc_FT, Tp_Doc_FT
     FROM [${ORDERS_SCHEMA}].[Tp_Doc_FT]
     ORDER BY Tp_Doc_FT ASC, ID_Tp_Doc_FT ASC`,
  )
  return result.recordset.map((row) => ({
    id: stringOrNull(row.ID_Tp_Doc_FT) ?? '',
    label: stringOrNull(row.Tp_Doc_FT) ?? '',
  }))
}

export class RecognitionCapacityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecognitionCapacityError'
  }
}

export class FacturacaoCapacityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FacturacaoCapacityError'
  }
}

export class PropagationValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PropagationValidationError'
  }
}

export class DatabaseRowNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DatabaseRowNotFoundError'
  }
}

export async function addReconhecimento(
  pool: ConnectionPool,
  input: NewReconhecimentoInput,
  user: string,
): Promise<ReconhecimentoRow> {
  const transaction = pool.transaction()
  await transaction.begin()
  try {
    const order = await lockRecognitionOrder(transaction, input.ID_Order)
    const existingRows = await readRecognitionCapacityRows(transaction, input.ID_Order)
    assertRecognitionCapacity(
      order,
      existingRows,
      input.ID_Tp_Reconhecimento,
      input.Valor_Reconhecimento,
    )

    const request = transaction.request()
    request.input('orderId', mssql.Int, input.ID_Order)
    request.input('type', mssql.NVarChar, input.ID_Tp_Reconhecimento)
    request.input('date', mssql.DateTime, input.DT_Reconhecimento)
    request.input('value', mssql.Money, input.Valor_Reconhecimento)
    request.input('user', mssql.NVarChar, user)
    const inserted = await request.query<Record<string, unknown>>(
      `INSERT INTO [${ORDERS_SCHEMA}].[${RECONHECIMENTO_TABLE}]
        (ID_Order, ID_Tp_Reconhecimento, DT_Reconhecimento, Valor_Reconhecimento, ID_User, DT_User)
       OUTPUT INSERTED.ID_Reconhecimento, INSERTED.ID_Order,
              INSERTED.ID_Tp_Reconhecimento, INSERTED.DT_Reconhecimento,
              INSERTED.Valor_Reconhecimento, INSERTED.ID_User, INSERTED.DT_User
       VALUES (@orderId, @type, @date, @value, @user, GETUTCDATE())`,
    )
    const row = inserted.recordset[0]
    if (!row) throw new Error('The database did not return the recognition row.')
    await transaction.commit()
    return toReconhecimentoRow(row)
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

export async function updateReconhecimento(
  pool: ConnectionPool,
  id: number,
  patch: ReconhecimentoPatch,
  user: string,
): Promise<ReconhecimentoRow | null> {
  const transaction = pool.transaction()
  await transaction.begin()
  try {
    const initialRequest = transaction.request()
    initialRequest.input('id', mssql.Int, id)
    const initial = await initialRequest.query<Record<string, unknown>>(
      `SELECT ID_Order
       FROM [${ORDERS_SCHEMA}].[${RECONHECIMENTO_TABLE}]
       WHERE ID_Reconhecimento = @id`,
    )
    const orderId = numberOrNull(initial.recordset[0]?.ID_Order)
    if (orderId === null) {
      await transaction.rollback()
      return null
    }

    const order = await lockRecognitionOrder(transaction, orderId)
    const currentRequest = transaction.request()
    currentRequest.input('id', mssql.Int, id)
    const currentResult = await currentRequest.query<Record<string, unknown>>(
      `SELECT ID_Reconhecimento, ID_Order, ID_Tp_Reconhecimento, DT_Reconhecimento,
              Valor_Reconhecimento, ID_User, DT_User
       FROM [${ORDERS_SCHEMA}].[${RECONHECIMENTO_TABLE}] WITH (UPDLOCK, HOLDLOCK)
       WHERE ID_Reconhecimento = @id`,
    )
    const currentRaw = currentResult.recordset[0]
    if (!currentRaw || numberOrNull(currentRaw.ID_Order) !== orderId) {
      await transaction.rollback()
      return null
    }
    const current = toReconhecimentoRow(currentRaw)
    const type = patch.ID_Tp_Reconhecimento ?? current.ID_Tp_Reconhecimento
    const date = patch.DT_Reconhecimento ?? current.DT_Reconhecimento
    const value = patch.Valor_Reconhecimento ?? current.Valor_Reconhecimento
    if (type === null || date === null || value === null) {
      throw new Error('Recognition rows require type, date, and value.')
    }

    const existingRows = await readRecognitionCapacityRows(transaction, orderId, id)
    assertRecognitionCapacity(order, existingRows, type, value)

    const request = transaction.request()
    request.input('id', mssql.Int, id)
    request.input('user', mssql.NVarChar, user)
    const setClauses: string[] = []
    for (const { column, type: sqlType } of RECONHECIMENTO_UPDATEABLE_COLUMNS) {
      if (column in patch) {
        setClauses.push(`${column} = @${column}`)
        request.input(column, sqlType, patch[column])
      }
    }
    setClauses.push('ID_User = @user', 'DT_User = GETUTCDATE()')
    const updated = await request.query<Record<string, unknown>>(
      `UPDATE [${ORDERS_SCHEMA}].[${RECONHECIMENTO_TABLE}]
       SET ${setClauses.join(', ')}
       OUTPUT INSERTED.ID_Reconhecimento, INSERTED.ID_Order,
              INSERTED.ID_Tp_Reconhecimento, INSERTED.DT_Reconhecimento,
              INSERTED.Valor_Reconhecimento, INSERTED.ID_User, INSERTED.DT_User
       WHERE ID_Reconhecimento = @id`,
    )
    const row = updated.recordset[0]
    if (!row) {
      await transaction.rollback()
      return null
    }
    await transaction.commit()
    return toReconhecimentoRow(row)
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

export async function deleteReconhecimento(pool: ConnectionPool, id: number): Promise<boolean> {
  const request = pool.request()
  request.input('id', mssql.Int, id)
  const result = await request.query(
    `DELETE FROM [${ORDERS_SCHEMA}].[${RECONHECIMENTO_TABLE}]
     WHERE ID_Reconhecimento = @id`,
  )
  return (result.rowsAffected[0] ?? 0) > 0
}

export async function propagateReconhecimento(
  pool: ConnectionPool,
  input: PropagateReconhecimentoInput,
  user: string,
): Promise<ReconhecimentoRow[]> {
  const transaction = pool.transaction()
  await transaction.begin()
  try {
    const request = transaction.request()
    request.input('orderId', mssql.Int, input.orderId)
    const orderResult = await request.query<Record<string, unknown>>(
      `SELECT o.ID_Order, o.ID_Tipo, t.Warranty AS Tipo_Warranty,
              o.Sell_Price, o.Warranty_Reserve, o.Warranty_DT_Inicio,
              tw.N_Anos
       FROM [${ORDERS_SCHEMA}].[${ORDERS_TABLE}] AS o WITH (UPDLOCK, HOLDLOCK)
       LEFT JOIN [${ORDERS_SCHEMA}].[Tipo] AS t ON o.ID_Tipo = t.ID_Tipo
       LEFT JOIN [${ORDERS_SCHEMA}].[Tp_Warranty] AS tw
         ON o.ID_Tp_Warranty = tw.ID_Tp_Warranty
       WHERE o.ID_Order = @orderId`,
    )
    const order = orderResult.recordset[0]
    if (!order) {
      throw new DatabaseRowNotFoundError(`Order ${input.orderId} was not found.`)
    }

    const lines = planPropagationLines(order, input)
    if (lines.length === 0) {
      await transaction.commit()
      return []
    }

    const existingRows = await readRecognitionCapacityRows(transaction, input.orderId)
    const plannedTotal = lines.reduce((sum, line) => sum + line.value, 0)
    assertRecognitionCapacity(order, existingRows, lines[0]?.type ?? '', plannedTotal)

    const created: ReconhecimentoRow[] = []
    for (let offset = 0; offset < lines.length; offset += PROPAGATION_CHUNK_SIZE) {
      const chunk = lines.slice(offset, offset + PROPAGATION_CHUNK_SIZE)
      const insertRequest = transaction.request()
      insertRequest.input('orderId', mssql.Int, input.orderId)
      insertRequest.input('type', mssql.NVarChar, chunk[0]?.type)
      insertRequest.input('user', mssql.NVarChar, user)
      const values = chunk.map((line, index) => {
        insertRequest.input(`date${index}`, mssql.DateTime, line.date)
        insertRequest.input(`value${index}`, mssql.Money, line.value)
        return `(@orderId, @type, @date${index}, @value${index}, @user, GETUTCDATE())`
      })
      const inserted = await insertRequest.query<Record<string, unknown>>(
        `INSERT INTO [${ORDERS_SCHEMA}].[${RECONHECIMENTO_TABLE}]
          (ID_Order, ID_Tp_Reconhecimento, DT_Reconhecimento, Valor_Reconhecimento, ID_User, DT_User)
         OUTPUT INSERTED.ID_Reconhecimento, INSERTED.ID_Order,
                INSERTED.ID_Tp_Reconhecimento, INSERTED.DT_Reconhecimento,
                INSERTED.Valor_Reconhecimento, INSERTED.ID_User, INSERTED.DT_User
         VALUES ${values.join(', ')}`,
      )
      created.push(...inserted.recordset.map(toReconhecimentoRow))
    }

    if (created.length !== lines.length) {
      throw new Error('The database did not return every propagated recognition row.')
    }
    await transaction.commit()
    return created.sort((left, right) => {
      const byDate = (left.DT_Reconhecimento ?? '').localeCompare(right.DT_Reconhecimento ?? '')
      return byDate !== 0 ? byDate : left.ID_Reconhecimento - right.ID_Reconhecimento
    })
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

export async function addFacturacao(
  pool: ConnectionPool,
  input: NewFacturacaoInput,
  user: string,
): Promise<DocumentoFaturacaoRow> {
  const transaction = pool.transaction()
  await transaction.begin()
  try {
    const sellPrice = await lockInvoicingOrder(transaction, input.ID_Order)
    const existing = await readInvoicingCapacityRows(transaction, input.ID_Order)
    assertInvoicingCapacity(sellPrice, existing, input.Valor_Doc_FT)

    const request = transaction.request()
    request.input('orderId', mssql.Int, input.ID_Order)
    request.input('date', mssql.DateTime, input.DT_Doc_FT)
    request.input('type', mssql.NVarChar, input.ID_Tp_Doc_FT)
    request.input('number', mssql.NVarChar, input.N_Doc_FT)
    request.input('value', mssql.Money, input.Valor_Doc_FT)
    request.input('user', mssql.NVarChar, user)
    const inserted = await request.query<Record<string, unknown>>(
      `INSERT INTO [${ORDERS_SCHEMA}].[${FACTURACAO_TABLE}]
        (ID_Order, DT_Doc_FT, ID_Tp_Doc_FT, N_Doc_FT, Valor_Doc_FT, ID_User, DT_User)
       OUTPUT INSERTED.ID_Facturacao, INSERTED.ID_Order, INSERTED.DT_Doc_FT,
              INSERTED.ID_Tp_Doc_FT, INSERTED.N_Doc_FT, INSERTED.Valor_Doc_FT,
              INSERTED.ID_User, INSERTED.DT_User
       VALUES (@orderId, @date, @type, @number, @value, @user, GETUTCDATE())`,
    )
    const row = inserted.recordset[0]
    if (!row) throw new Error('The database did not return the invoice row.')
    await transaction.commit()
    return toFacturacaoRow(row)
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

export async function updateFacturacao(
  pool: ConnectionPool,
  id: number,
  patch: FacturacaoPatch,
  user: string,
): Promise<DocumentoFaturacaoRow | null> {
  const transaction = pool.transaction()
  await transaction.begin()
  try {
    const initialRequest = transaction.request()
    initialRequest.input('id', mssql.Int, id)
    const initial = await initialRequest.query<Record<string, unknown>>(
      `SELECT ID_Order
       FROM [${ORDERS_SCHEMA}].[${FACTURACAO_TABLE}]
       WHERE ID_Facturacao = @id`,
    )
    const orderId = numberOrNull(initial.recordset[0]?.ID_Order)
    if (orderId === null) {
      await transaction.rollback()
      return null
    }

    const sellPrice = await lockInvoicingOrder(transaction, orderId)
    const currentRequest = transaction.request()
    currentRequest.input('id', mssql.Int, id)
    const currentResult = await currentRequest.query<Record<string, unknown>>(
      `SELECT ID_Facturacao, ID_Order, DT_Doc_FT, ID_Tp_Doc_FT, N_Doc_FT,
              Valor_Doc_FT, ID_User, DT_User
       FROM [${ORDERS_SCHEMA}].[${FACTURACAO_TABLE}] WITH (UPDLOCK, HOLDLOCK)
       WHERE ID_Facturacao = @id`,
    )
    const currentRaw = currentResult.recordset[0]
    if (!currentRaw || numberOrNull(currentRaw.ID_Order) !== orderId) {
      await transaction.rollback()
      return null
    }
    const current = toFacturacaoRow(currentRaw)
    const value = patch.Valor_Doc_FT ?? current.Valor_Doc_FT
    if (value === null) throw new Error('Invoice rows require a value.')

    const existing = await readInvoicingCapacityRows(transaction, orderId, id)
    assertInvoicingCapacity(sellPrice, existing, value)

    const request = transaction.request()
    request.input('id', mssql.Int, id)
    request.input('user', mssql.NVarChar, user)
    const setClauses: string[] = []
    for (const { column, type } of FACTURACAO_UPDATEABLE_COLUMNS) {
      if (column in patch) {
        setClauses.push(`${column} = @${column}`)
        request.input(column, type, patch[column])
      }
    }
    setClauses.push('ID_User = @user', 'DT_User = GETUTCDATE()')
    const updated = await request.query<Record<string, unknown>>(
      `UPDATE [${ORDERS_SCHEMA}].[${FACTURACAO_TABLE}]
       SET ${setClauses.join(', ')}
       OUTPUT INSERTED.ID_Facturacao, INSERTED.ID_Order, INSERTED.DT_Doc_FT,
              INSERTED.ID_Tp_Doc_FT, INSERTED.N_Doc_FT, INSERTED.Valor_Doc_FT,
              INSERTED.ID_User, INSERTED.DT_User
       WHERE ID_Facturacao = @id`,
    )
    const row = updated.recordset[0]
    if (!row) {
      await transaction.rollback()
      return null
    }
    await transaction.commit()
    return toFacturacaoRow(row)
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

export async function deleteFacturacao(pool: ConnectionPool, id: number): Promise<boolean> {
  const request = pool.request()
  request.input('id', mssql.Int, id)
  const result = await request.query(
    `DELETE FROM [${ORDERS_SCHEMA}].[${FACTURACAO_TABLE}]
     WHERE ID_Facturacao = @id`,
  )
  return (result.rowsAffected[0] ?? 0) > 0
}

type TransactionLike = ReturnType<ConnectionPool['transaction']>
type RecognitionCapacityRow = Pick<
  ReconhecimentoRow,
  'ID_Tp_Reconhecimento' | 'Valor_Reconhecimento'
>
type PropagationLine = { type: 'WP' | 'CM'; date: Date; value: number }

async function lockRecognitionOrder(
  transaction: TransactionLike,
  orderId: number,
): Promise<Record<string, unknown>> {
  const request = transaction.request()
  request.input('orderId', mssql.Int, orderId)
  const result = await request.query<Record<string, unknown>>(
    `SELECT o.Sell_Price, o.Warranty_Reserve, t.Warranty AS Tipo_Warranty
     FROM [${ORDERS_SCHEMA}].[${ORDERS_TABLE}] AS o WITH (UPDLOCK, HOLDLOCK)
     LEFT JOIN [${ORDERS_SCHEMA}].[Tipo] AS t ON o.ID_Tipo = t.ID_Tipo
     WHERE o.ID_Order = @orderId`,
  )
  const order = result.recordset[0]
  if (!order) throw new DatabaseRowNotFoundError(`Order ${orderId} was not found.`)
  return order
}

async function readRecognitionCapacityRows(
  transaction: TransactionLike,
  orderId: number,
  excludeId?: number,
): Promise<RecognitionCapacityRow[]> {
  const request = transaction.request()
  request.input('orderId', mssql.Int, orderId)
  if (excludeId !== undefined) request.input('excludeId', mssql.Int, excludeId)
  const result = await request.query<Record<string, unknown>>(
    `SELECT ID_Tp_Reconhecimento, Valor_Reconhecimento
     FROM [${ORDERS_SCHEMA}].[${RECONHECIMENTO_TABLE}] WITH (UPDLOCK, HOLDLOCK)
     WHERE ID_Order = @orderId${excludeId === undefined ? '' : ' AND ID_Reconhecimento <> @excludeId'}`,
  )
  return result.recordset.map((row) => ({
    ID_Tp_Reconhecimento: stringOrNull(row.ID_Tp_Reconhecimento),
    Valor_Reconhecimento: numberOrNull(row.Valor_Reconhecimento),
  }))
}

function assertRecognitionCapacity(
  order: Record<string, unknown>,
  existingRows: RecognitionCapacityRow[],
  candidateType: string,
  candidateValue: number,
): void {
  const sellPrice = numberOrNull(order.Sell_Price)
  if (sellPrice === null) {
    throw new RecognitionCapacityError('O Sell Price é obrigatório para reconhecer valores.')
  }
  const warrantyReserve =
    booleanOrNull(order.Tipo_Warranty) === true
      ? (numberOrNull(order.Warranty_Reserve) ?? 0)
      : 0
  let instrument = 0
  let warranty = 0
  for (const row of existingRows) {
    const value = row.Valor_Reconhecimento ?? 0
    if (isWarrantyRecognitionType(row.ID_Tp_Reconhecimento)) warranty += value
    else instrument += value
  }
  if (isWarrantyRecognitionType(candidateType)) warranty += candidateValue
  else instrument += candidateValue

  const total = instrument + warranty
  if (total > sellPrice + MONEY_EPSILON) {
    throw new RecognitionCapacityError('O total reconhecido não pode ultrapassar o Sell Price.')
  }
  if (warranty > warrantyReserve + MONEY_EPSILON) {
    throw new RecognitionCapacityError(
      'O total reconhecido em garantia não pode ultrapassar a Warranty Reserve.',
    )
  }
  if (instrument > sellPrice - warrantyReserve + MONEY_EPSILON) {
    throw new RecognitionCapacityError(
      'O valor reservado para garantia não pode ser reconhecido com outro tipo de reconhecimento.',
    )
  }
}

function assertExistingRecognitionCapacity(
  order: Record<string, unknown>,
  existingRows: RecognitionCapacityRow[],
): void {
  if (existingRows.some((row) => (row.Valor_Reconhecimento ?? 0) !== 0)) {
    assertRecognitionCapacity(order, existingRows, '', 0)
  }
}

function assertExistingInvoicingCapacity(
  order: Record<string, unknown>,
  existingRows: Array<{ Valor_Doc_FT: number | null }>,
): void {
  if (!existingRows.some((row) => (row.Valor_Doc_FT ?? 0) !== 0)) return
  const sellPrice = numberOrNull(order.Sell_Price)
  if (sellPrice === null) {
    throw new FacturacaoCapacityError('O Sell Price é obrigatório para faturar valores.')
  }
  assertInvoicingCapacity(sellPrice, existingRows, 0)
}

function isWarrantyRecognitionType(type: unknown): boolean {
  return type === 'W' || type === 'WP'
}

async function lockInvoicingOrder(transaction: TransactionLike, orderId: number): Promise<number> {
  const request = transaction.request()
  request.input('orderId', mssql.Int, orderId)
  const result = await request.query<Record<string, unknown>>(
    `SELECT Sell_Price
     FROM [${ORDERS_SCHEMA}].[${ORDERS_TABLE}] WITH (UPDLOCK, HOLDLOCK)
     WHERE ID_Order = @orderId`,
  )
  if (!result.recordset[0]) {
    throw new DatabaseRowNotFoundError(`Order ${orderId} was not found.`)
  }
  const sellPrice = numberOrNull(result.recordset[0].Sell_Price)
  if (sellPrice === null) {
    throw new FacturacaoCapacityError('O Sell Price é obrigatório para faturar valores.')
  }
  return sellPrice
}

async function readInvoicingCapacityRows(
  transaction: TransactionLike,
  orderId: number,
  excludeId?: number,
): Promise<Array<{ Valor_Doc_FT: number | null }>> {
  const request = transaction.request()
  request.input('orderId', mssql.Int, orderId)
  if (excludeId !== undefined) request.input('excludeId', mssql.Int, excludeId)
  const result = await request.query<Record<string, unknown>>(
    `SELECT Valor_Doc_FT
     FROM [${ORDERS_SCHEMA}].[${FACTURACAO_TABLE}] WITH (UPDLOCK, HOLDLOCK)
     WHERE ID_Order = @orderId${excludeId === undefined ? '' : ' AND ID_Facturacao <> @excludeId'}`,
  )
  return result.recordset.map((row) => ({ Valor_Doc_FT: numberOrNull(row.Valor_Doc_FT) }))
}

function assertInvoicingCapacity(
  sellPrice: number,
  existingRows: Array<{ Valor_Doc_FT: number | null }>,
  candidateValue: number,
): void {
  const currentNet = existingRows.reduce((sum, row) => sum + (row.Valor_Doc_FT ?? 0), 0)
  if (currentNet + candidateValue > sellPrice + MONEY_EPSILON) {
    throw new FacturacaoCapacityError('O net faturado não pode ultrapassar o Sell Price.')
  }
}

function planPropagationLines(
  order: Record<string, unknown>,
  input: PropagateReconhecimentoInput,
): PropagationLine[] {
  if (input.kind === 'warranty') {
    if (booleanOrNull(order.Tipo_Warranty) !== true) {
      throw new PropagationValidationError('Este tipo de pedido não tem garantia.')
    }
    const warrantyReserve = numberOrNull(order.Warranty_Reserve)
    const start = dateOrNull(order.Warranty_DT_Inicio)
    const years = numberOrNull(order.N_Anos)
    if (warrantyReserve === null || warrantyReserve <= 0 || start === null || years === null) {
      throw new PropagationValidationError(
        'Warranty Reserve, início e duração da garantia são obrigatórios.',
      )
    }
    const months = (years - 1) * 12
    if (months <= 0) return []
    const values = allocateMoney(warrantyReserve, months)
    const first = addUtcMonths(firstUtcMonth(start), 12)
    return values.map((value, index) => ({
      type: 'WP',
      date: addUtcMonths(first, index),
      value,
    }))
  }

  if (stringOrNull(order.ID_Tipo) !== 'CM') {
    throw new PropagationValidationError('A propagação de contrato só se aplica ao tipo CM.')
  }
  const sellPrice = numberOrNull(order.Sell_Price)
  const start = dateOrNull(input.startDate)
  if (sellPrice === null || sellPrice <= 0 || start === null) {
    throw new PropagationValidationError('Sell Price e início do contrato são obrigatórios.')
  }
  const months = input.years * 12
  const values = allocateMoney(sellPrice, months)
  const first = firstUtcMonth(start)
  return values.map((value, index) => ({
    type: 'CM',
    date: addUtcMonths(first, index),
    value,
  }))
}

function allocateMoney(total: number, count: number): number[] {
  const totalUnits = Math.round(total * 10_000)
  const baseUnits = Math.floor(totalUnits / count)
  const remainder = totalUnits - baseUnits * count
  return Array.from(
    { length: count },
    (_, index) => (baseUnits + (index < remainder ? 1 : 0)) / 10_000,
  )
}

function dateOrNull(value: unknown): Date | null {
  const date = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : null
  return date !== null && !Number.isNaN(date.getTime()) ? date : null
}

function firstUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function addUtcMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
}

export async function fetchUtilizadores(pool: ConnectionPool): Promise<UtilizadorRow[]> {
  const result = await pool.request().query<Record<string, unknown>>(
    `SELECT ID_User, User_Name, Read_Only, Admin, DT_Criacao, Cancelado, DT_Cancelado, Obs
     FROM [${ORDERS_SCHEMA}].[Utilizador]
     ORDER BY User_Name ASC, ID_User ASC`,
  )
  return result.recordset.map((row) => ({
    ID_User: stringOrNull(row.ID_User) ?? '',
    User_Name: stringOrNull(row.User_Name),
    Read_Only: booleanOrNull(row.Read_Only),
    Admin: booleanOrNull(row.Admin),
    DT_Criacao: dateTimeOrNull(row.DT_Criacao),
    Cancelado: booleanOrNull(row.Cancelado),
    DT_Cancelado: dateTimeOrNull(row.DT_Cancelado),
    Obs: stringOrNull(row.Obs),
  }))
}

export async function createUtilizador(
  pool: ConnectionPool,
  userId: string,
  userName: string,
  admin: boolean,
  obs: string | null,
): Promise<UtilizadorRow> {
  const transaction = pool.transaction()
  await transaction.begin()
  try {
    const request = transaction.request()
    request.input('id', mssql.NVarChar, userId)
    request.input('name', mssql.NVarChar, userName)
    request.input('admin', mssql.Bit, admin)
    request.input('readOnly', mssql.Bit, false)
    request.input('obs', mssql.NVarChar, obs)
    const result = await request.query<{ ID_User: string }>(
      `INSERT INTO [${ORDERS_SCHEMA}].[Utilizador]
        (ID_User, User_Name, Read_Only, Admin, DT_Criacao, Cancelado, Obs)
       OUTPUT INSERTED.ID_User
       VALUES (@id, @name, @readOnly, @admin, GETUTCDATE(), 0, @obs)`,
    )
    await transaction.commit()
    const id = result.recordset[0]?.ID_User
    if (!id) throw new Error('The database did not return the user identifier.')
    const rows = await fetchUtilizadores(pool)
    const created = rows.find((row) => row.ID_User === id)
    if (!created) throw new Error('The user could not be read after creation.')
    return created
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

function toSummaryRow(row: Record<string, unknown>): OrderSummaryRow {
  return {
    ID_Order: numberOrThrow(row, 'ID_Order'),
    // DT_Order is NOT NULL on the live table; the empty-string fallback is defensive only
    // (a stray null would render as "—" rather than 502 the whole list). mssql returns
    // datetime columns as JS Date objects — coerce to ISO 8601 UTC (TIMEZONE.md) so the
    // wire contract is a stable ISO string, never a Date.toString() locale dump.
    DT_Order: dateTimeOrEmpty(row['DT_Order']),
    Order_Factory: booleanOrNull(row['Order_Factory']),
    ID_Tp_Order: stringOrNull(row['ID_Tp_Order']),
    ID_Client: numberOrNull(row['ID_Client']),
    Client_Name: stringOrNull(row['Client_Name']),
    ID_Area: stringOrNull(row['ID_Area']),
    ID_Tipo: stringOrNull(row['ID_Tipo']),
    ID_Produto: numberOrNull(row['ID_Produto']),
    ID_Instrumento: numberOrNull(row['ID_Instrumento']),
    Sell_Price: numberOrNull(row['Sell_Price']),
    Negocio_Fechado: booleanOrNull(row['Negocio_Fechado']),
    Encomenda_Cli_PHC: stringOrNull(row['Encomenda_Cli_PHC']),
    Provisoria: booleanOrNull(row['Provisoria']),
  }
}

function toDetailRow(row: Record<string, unknown>): OrderDetailRow {
  return {
    ...toSummaryRow(row),
    Tipo_Warranty: booleanOrNull(row['Tipo_Warranty']),
    Orc_Proposta: stringOrNull(row['Orc_Proposta']),
    PO_Cliente: stringOrNull(row['PO_Cliente']),
    ID_Tp_Warranty: numberOrNull(row['ID_Tp_Warranty']),
    Warranty_Reserve: numberOrNull(row['Warranty_Reserve']),
    Warranty_DT_Inicio: dateTimeOrNull(row['Warranty_DT_Inicio']),
    ID_Tp_Revenue: numberOrNull(row['ID_Tp_Revenue']),
    Facturado: booleanOrNull(row['Facturado']),
    Reconhecido: booleanOrNull(row['Reconhecido']),
    Cod_Enc_Fornecedor: stringOrNull(row['Cod_Enc_Fornecedor']),
    Obs: stringOrNull(row['Obs']),
    ID_User: stringOrNull(row['ID_User']),
    DT_User: dateTimeOrNull(row['DT_User']),
    Kit: booleanOrNull(row['Kit']),
    Kit_Amount: numberOrNull(row['Kit_Amount']),
    Contacto: stringOrNull(row['Contacto']),
  }
}

function toClientSummaryRow(row: Record<string, unknown>): ClientSummaryRow {
  return {
    ID_Cliente: numberOrThrow(row, 'ID_Cliente'),
    no_PHC: numberOrNull(row['no_PHC']),
    ID_Tp_Cliente: numberOrNull(row['ID_Tp_Cliente']),
    nome: stringOrNull(row['nome']),
    ncont: numberOrNull(row['ncont']),
    telefone: stringOrNull(row['telefone']),
    local: stringOrNull(row['local']),
  }
}

function toClientDetailRow(row: Record<string, unknown>): ClientDetailRow {
  return {
    ...toClientSummaryRow(row),
    fax: stringOrNull(row['fax']),
    contacto: stringOrNull(row['contacto']),
    morada: stringOrNull(row['morada']),
    codpost: stringOrNull(row['codpost']),
    zona: stringOrNull(row['zona']),
    Defense: booleanOrNull(row['Defense']),
  }
}

function toReconhecimentoRow(row: Record<string, unknown>): ReconhecimentoRow {
  return {
    ID_Reconhecimento: numberOrThrow(row, 'ID_Reconhecimento'),
    ID_Order: numberOrThrow(row, 'ID_Order'),
    ID_Tp_Reconhecimento: stringOrNull(row['ID_Tp_Reconhecimento']),
    DT_Reconhecimento: dateTimeOrNull(row['DT_Reconhecimento']),
    Valor_Reconhecimento: numberOrNull(row['Valor_Reconhecimento']),
    ID_User: stringOrNull(row['ID_User']),
    DT_User: dateTimeOrNull(row['DT_User']),
  }
}

function toFacturacaoRow(row: Record<string, unknown>): DocumentoFaturacaoRow {
  return {
    ID_Facturacao: numberOrThrow(row, 'ID_Facturacao'),
    ID_Order: numberOrThrow(row, 'ID_Order'),
    DT_Doc_FT: dateTimeOrNull(row['DT_Doc_FT']),
    ID_Tp_Doc_FT: stringOrNull(row['ID_Tp_Doc_FT']),
    N_Doc_FT: stringOrNull(row['N_Doc_FT']),
    Valor_Doc_FT: numberOrNull(row['Valor_Doc_FT']),
    ID_User: stringOrNull(row['ID_User']),
    DT_User: dateTimeOrNull(row['DT_User']),
  }
}

// Builds "@name0, @name1, …" for a parameterized IN clause. The column name is a hardcoded
// constant (never user input), so only the parameter count is dynamic.
function placeholders(name: string, count: number): string {
  return Array.from({ length: count }, (_, index) => `@${name}${index}`).join(', ')
}

// mssql returns booleans for `bit` columns, numbers for `int`/`money`, and JS Date
// objects for `datetime`/`datetime2` columns. The Date helpers below coerce to ISO 8601
// UTC (TIMEZONE.md); the rest coerce defensively and tolerate null/undefined.
function numberOrThrow(row: Record<string, unknown>, key: string): number {
  const value = row[key]
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Expected numeric column ${key} in orders row, got ${typeof value}`)
  }
  return value
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  return typeof value === 'number' && !Number.isNaN(value) ? value : Number(value)
}

function stringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null
  return typeof value === 'string' ? value : String(value)
}

// datetime columns arrive as JS Date objects; serialize to ISO 8601 UTC. A string is
// passed through (already ISO or a date-only value the formatter parses). Invalid dates
// and unexpected types fall back to the empty/null branch so one bad row can't 502 the
// whole response.
function dateTimeOrEmpty(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString()
  if (typeof value === 'string') return value
  return ''
}

function dateTimeOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString()
  if (typeof value === 'string') return value
  return null
}

function booleanOrNull(value: unknown): boolean | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  return null
}
