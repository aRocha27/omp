import { createRequire } from 'node:module'
import type { config as SqlConfig, ConnectionPool, ISqlType } from 'mssql'
import { logger } from './logger.js'
import type {
  AreaRow,
  ClientCreateInput,
  ClientDetailRow,
  ClientSummaryRow,
  ClientUpdateChanges,
  ConnectionConfig,
  DashboardRecognitionQueueRow,
  DashboardSnapshotRow,
  DocumentoFaturacaoRow,
  DocumentoFaturacaoTypeRow,
  InstrumentoRow,
  OrderDetailRow,
  OrderCreateInput,
  OrderSummaryRow,
  OrderUpdateChanges,
  ProdutoRow,
  ReconhecimentoRow,
  NewReconhecimentoInput,
  NewFacturacaoInput,
  ReconhecimentoPatch,
  FacturacaoPatch,
  PropagateReconhecimentoInput,
  KitConsumableRow,
  NewKitConsumableInput,
  KitConsumablePatch,
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
const RECOGNITION_BACKLOG_VIEW = '11-Reconhecimento-PorReconhecer'
const RECOGNITION_MONTHLY_VIEW = 'V_Reconhecimento_Monthly_Crosstab'
const FACTURACAO_TABLE = 'Facturacao'
const KIT_CONSUMABLES_TABLE = 'Kit_Consumables'
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

const KIT_CONSUMABLES_UPDATEABLE_COLUMNS: ReadonlyArray<{
  column: keyof KitConsumablePatch
  type: ISqlType | (() => ISqlType)
}> = [
  { column: 'Date', type: mssql.DateTime },
  { column: 'Internal_Order', type: mssql.NVarChar },
  { column: 'Material', type: mssql.NVarChar },
  { column: 'Description', type: mssql.NVarChar },
  { column: 'Quant', type: mssql.Int },
  { column: 'Unit_Price', type: mssql.Money },
  { column: 'Total_Price', type: mssql.Money },
]

// Hardcoded whitelist of dbo.[Order] columns an editor may UPDATE. Column names are
// constants (never user input), so building the SET clause from this list is safe by
// construction — there is no injection surface. Each entry pairs the column with its
// mssql bind type so the parameterized UPDATE uses the right SQL Server type. Keep the
// keys in sync with OrderUpdatePatch in types.ts.
const UPDATEABLE_COLUMNS: ReadonlyArray<{ column: string; type: ISqlType | (() => ISqlType) }> = [
  { column: 'DT_Order', type: mssql.DateTime },
  { column: 'Order_Factory', type: mssql.Bit },
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

// Hardcoded whitelist of dbo.Client columns the create + update endpoints may write.
// Column names are constants (never user input), so building the INSERT/UPDATE clause
// from this list is safe by construction — there is no injection surface. Keep the
// keys in sync with ClientCreateInput and ClientUpdatePatch in types.ts.
const UPDATEABLE_CLIENT_COLUMNS: ReadonlyArray<{
  column: string
  type: ISqlType | (() => ISqlType)
}> = [
  { column: 'no_PHC', type: mssql.Int },
  { column: 'ID_Tp_Cliente', type: mssql.Int },
  { column: 'nome', type: mssql.NVarChar },
  { column: 'ncont', type: mssql.NVarChar },
  { column: 'fax', type: mssql.NVarChar },
  { column: 'telefone', type: mssql.NVarChar },
  { column: 'contacto', type: mssql.NVarChar },
  { column: 'morada', type: mssql.NVarChar },
  { column: 'local', type: mssql.NVarChar },
  { column: 'codpost', type: mssql.NVarChar },
  { column: 'zona', type: mssql.NVarChar },
  { column: 'Defense', type: mssql.Bit },
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
    where.push('v.DT_Order >= @dateFrom')
    request.input('dateFrom', mssql.NVarChar, filters.dateFrom)
  }
  if (filters.dateTo) {
    // Half-open upper bound: an inclusive `dateTo` of "2025-09-12" must cover rows at
    // 2025-09-12 14:00. A bare `<=` on a datetime would drop them. DATEADD runs server-side.
    where.push('v.DT_Order < DATEADD(day, 1, @dateTo)')
    request.input('dateTo', mssql.NVarChar, filters.dateTo)
  }
  if (filters.clientName) {
    where.push('v.nome LIKE @clientName')
    request.input('clientName', mssql.NVarChar, `%${filters.clientName}%`)
  }
  if (filters.orderFactory !== undefined) {
    where.push('v.Order_Factory = @orderFactory')
    request.input('orderFactory', mssql.Bit, filters.orderFactory)
  }
  if (filters.negocioFechado !== undefined) {
    where.push('v.Negocio_Fechado = @negocioFechado')
    request.input('negocioFechado', mssql.Bit, filters.negocioFechado)
  }
  // Categorical multi-select filters expand to parameterized `IN (@p0, @p1, …)`.
  // Values are bound as parameters (never interpolated into the SQL), so there is no
  // injection surface; only the placeholder count is dynamic. SQL Server has a hard
  // limit of 2100 parameters per query — the frontend reference-data sets are far below
  // that (instrumentos is the largest at 70).
  if (filters.idTpOrder && filters.idTpOrder.length > 0) {
    where.push(`v.ID_Tp_Order IN (${placeholders('idTpOrder', filters.idTpOrder.length)})`)
    filters.idTpOrder.forEach((value, index) => {
      request.input(`idTpOrder${index}`, mssql.NVarChar, value)
    })
  }
  if (filters.idArea && filters.idArea.length > 0) {
    where.push(`v.ID_Area IN (${placeholders('idArea', filters.idArea.length)})`)
    filters.idArea.forEach((value, index) => {
      request.input(`idArea${index}`, mssql.NVarChar, value)
    })
  }
  if (filters.idTipo && filters.idTipo.length > 0) {
    where.push(`v.ID_Tipo IN (${placeholders('idTipo', filters.idTipo.length)})`)
    filters.idTipo.forEach((value, index) => {
      request.input(`idTipo${index}`, mssql.NVarChar, value)
    })
  }
  if (filters.idProduto && filters.idProduto.length > 0) {
    where.push(`v.ID_Produto IN (${placeholders('idProduto', filters.idProduto.length)})`)
    filters.idProduto.forEach((value, index) => {
      request.input(`idProduto${index}`, mssql.Int, value)
    })
  }
  if (filters.idInstrumento && filters.idInstrumento.length > 0) {
    where.push(`v.ID_Instrumento IN (${placeholders('idInstrumento', filters.idInstrumento.length)})`)
    filters.idInstrumento.forEach((value, index) => {
      request.input(`idInstrumento${index}`, mssql.Int, value)
    })
  }
  if (filters.encomendaCliPHC) {
    where.push('v.Encomenda_Cli_PHC LIKE @encomendaCliPHC')
    request.input('encomendaCliPHC', mssql.NVarChar, `%${filters.encomendaCliPHC}%`)
  }

  request.input('limit', mssql.Int, limit)
  // The view lacks the 7 Order-table-only columns the list grid now renders. LEFT JOIN
  // the base [Order] table (keyed by ID_Order) so a row present in the view but missing
  // from [Order] still resolves with those columns NULL rather than dropping the row —
  // the view is the source of truth for which orders exist. Aliasing the view columns
  // avoids ambiguous-column errors with the join.
  const sql = `SELECT TOP (@limit)
    v.ID_Order, v.DT_Order, v.Order_Factory, v.ID_Tp_Order, v.ID_Client,
    v.nome AS Client_Name, v.ID_Area, v.ID_Tipo, v.ID_Produto, v.ID_Instrumento,
    v.Sell_Price, v.Negocio_Fechado, v.Encomenda_Cli_PHC, v.Provisoria,
    o.Kit, o.ID_Tp_Warranty, o.Warranty_Reserve, o.Warranty_DT_Inicio,
    o.Orc_Proposta, o.PO_Cliente, o.ID_Tp_Revenue
  FROM [${ORDERS_SCHEMA}].[${ORDERS_VIEW}] AS v
  LEFT JOIN [${ORDERS_SCHEMA}].[${ORDERS_TABLE}] AS o ON o.ID_Order = v.ID_Order
  ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
  ORDER BY v.DT_Order DESC, v.ID_Order DESC`

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

// Dashboard snapshot. Reads only from trusted DB-backed sources: dbo.[Order] for booked
// orders + NOB, dbo.Reconhecimento for recognized revenue, and the verified
// dbo.[11-Reconhecimento-PorReconhecer] view for the queue rows. KPI semantics:
// - NOB YTD / Revenue Recognized YTD are true YTD measures: from 1 Jan of the
//   snapshot year up to "today" (not the full civil year), filtered to Client
//   orders only (`ID_Tp_Order = 'C'`).
// - "Backlog at Period Start" is computed as:
//   Σ Sell_Price of Client orders booked before the exercise start
//   - Σ Valor_Reconhecimento of those same orders recognized before the exercise start
//   where the exercise start is 1 Jan of the snapshot year.
// - "Backlog to Recognize" is the roll-forward of that opening backlog:
//     backlogAtPeriodStart + nobYtd - revenueRecognizedYtd
//   which is equivalent to "all Client orders before today minus all Client
//   recognitions before today". The endpoint is current-year only; callers do
//   not choose the year.
export async function fetchDashboardSnapshot(
  pool: ConnectionPool,
  today: Date = new Date(),
): Promise<DashboardSnapshotRow> {
  const year = today.getUTCFullYear()
  const yearStart = new Date(Date.UTC(year, 0, 1))
  const todayCutoff = today
  const currentMonth = today.getUTCMonth() + 1

  const kpisRequest = pool.request()
  kpisRequest.input('yearStart', mssql.DateTime, yearStart)
  kpisRequest.input('todayCutoff', mssql.DateTime, todayCutoff)
  const kpisResult = await kpisRequest.query<Record<string, unknown>>(
     `SELECT
        (SELECT COUNT(*)
         FROM [${ORDERS_SCHEMA}].[${ORDERS_TABLE}]
         WHERE DT_Order >= @yearStart AND DT_Order < @todayCutoff) AS ordersBookedYtd,
        (SELECT COALESCE(SUM(COALESCE(Sell_Price, 0)), 0)
         FROM [${ORDERS_SCHEMA}].[${ORDERS_TABLE}]
         WHERE DT_Order >= @yearStart AND DT_Order < @todayCutoff AND ID_Tp_Order = 'C') AS nobYtd,
        (SELECT COALESCE(SUM(COALESCE(Valor_Reconhecimento, 0)), 0)
         FROM [${ORDERS_SCHEMA}].[${RECONHECIMENTO_TABLE}] AS r
         INNER JOIN [${ORDERS_SCHEMA}].[${ORDERS_TABLE}] AS o ON o.ID_Order = r.ID_Order
         WHERE r.DT_Reconhecimento >= @yearStart AND r.DT_Reconhecimento < @todayCutoff AND o.ID_Tp_Order = 'C') AS revenueRecognizedYtd,
        (
          (
            (SELECT COALESCE(SUM(COALESCE(o.Sell_Price, 0)), 0)
             FROM [${ORDERS_SCHEMA}].[${ORDERS_TABLE}] AS o
             WHERE o.DT_Order < @yearStart AND o.ID_Tp_Order = 'C')
            -
            (SELECT COALESCE(SUM(COALESCE(r.Valor_Reconhecimento, 0)), 0)
             FROM [${ORDERS_SCHEMA}].[${RECONHECIMENTO_TABLE}] AS r
             INNER JOIN [${ORDERS_SCHEMA}].[${ORDERS_TABLE}] AS o ON o.ID_Order = r.ID_Order
             WHERE o.DT_Order < @yearStart AND o.ID_Tp_Order = 'C' AND r.DT_Reconhecimento < @yearStart)
          )
          +
          (SELECT COALESCE(SUM(COALESCE(o.Sell_Price, 0)), 0)
           FROM [${ORDERS_SCHEMA}].[${ORDERS_TABLE}] AS o
           WHERE o.DT_Order >= @yearStart AND o.DT_Order < @todayCutoff AND o.ID_Tp_Order = 'C')
          -
          (SELECT COALESCE(SUM(COALESCE(r.Valor_Reconhecimento, 0)), 0)
           FROM [${ORDERS_SCHEMA}].[${RECONHECIMENTO_TABLE}] AS r
           INNER JOIN [${ORDERS_SCHEMA}].[${ORDERS_TABLE}] AS o ON o.ID_Order = r.ID_Order
           WHERE r.DT_Reconhecimento >= @yearStart AND r.DT_Reconhecimento < @todayCutoff AND o.ID_Tp_Order = 'C')
        ) AS backlogToRecognize,
        (
          (SELECT COALESCE(SUM(COALESCE(o.Sell_Price, 0)), 0)
           FROM [${ORDERS_SCHEMA}].[${ORDERS_TABLE}] AS o
           WHERE o.DT_Order < @yearStart AND o.ID_Tp_Order = 'C')
          -
          (SELECT COALESCE(SUM(COALESCE(r.Valor_Reconhecimento, 0)), 0)
           FROM [${ORDERS_SCHEMA}].[${RECONHECIMENTO_TABLE}] AS r
           INNER JOIN [${ORDERS_SCHEMA}].[${ORDERS_TABLE}] AS o ON o.ID_Order = r.ID_Order
           WHERE o.DT_Order < @yearStart AND o.ID_Tp_Order = 'C' AND r.DT_Reconhecimento < @yearStart)
        ) AS backlogAtPeriodStart`,
   )

  const trendRequest = pool.request()
  trendRequest.input('yearStart', mssql.DateTime, yearStart)
  trendRequest.input('todayCutoff', mssql.DateTime, todayCutoff)
  const trendResult = await trendRequest.query<Record<string, unknown>>(
     `SELECT month_num, SUM(revenue) AS revenue, SUM(nob) AS nob
      FROM (
        SELECT MONTH(DT_Reconhecimento) AS month_num,
               COALESCE(SUM(COALESCE(Valor_Reconhecimento, 0)), 0) AS revenue,
               CAST(0 AS money) AS nob
        FROM [${ORDERS_SCHEMA}].[${RECONHECIMENTO_TABLE}]
        WHERE DT_Reconhecimento >= @yearStart AND DT_Reconhecimento < @todayCutoff
        GROUP BY MONTH(DT_Reconhecimento)
        UNION ALL
        SELECT MONTH(DT_Order) AS month_num,
               CAST(0 AS money) AS revenue,
               COALESCE(SUM(COALESCE(Sell_Price, 0)), 0) AS nob
        FROM [${ORDERS_SCHEMA}].[${ORDERS_TABLE}]
        WHERE DT_Order >= @yearStart AND DT_Order < @todayCutoff
        GROUP BY MONTH(DT_Order)
      ) AS trend
     GROUP BY month_num
     ORDER BY month_num`,
  )

  const recognitionQueue = await fetchRecognitionQueue(pool)

  const recentOrders = await fetchOrderSummaries(pool, {}, 5)

  return {
    year,
    kpis: {
      ordersBookedYtd: numberOrNull(kpisResult.recordset[0]?.ordersBookedYtd) ?? 0,
      nobYtd: numberOrNull(kpisResult.recordset[0]?.nobYtd) ?? 0,
      revenueRecognizedYtd: numberOrNull(kpisResult.recordset[0]?.revenueRecognizedYtd) ?? 0,
      backlogToRecognize: numberOrNull(kpisResult.recordset[0]?.backlogToRecognize) ?? 0,
      backlogAtPeriodStart: numberOrNull(kpisResult.recordset[0]?.backlogAtPeriodStart) ?? 0,
    },
    monthlyTrend: buildDashboardTrend(trendResult.recordset, year, currentMonth),
    recognitionQueue,
    recentOrders,
  }
}

/**
 * Reads every row from dbo.[11-Reconhecimento-PorReconhecer] with positive remaining
 * value. Same column shape the dashboard queue card shows; exposed via a dedicated
 * endpoint so the "View all" modal can render the full backlog (the snapshot only
 * returns what fits on the dashboard card, even though that limit was removed — the
 * endpoint still gives callers a focused query that skips KPIs/trend/recent orders).
 */
export async function fetchRecognitionQueue(
  pool: ConnectionPool,
): Promise<DashboardSnapshotRow['recognitionQueue']> {
  const request = pool.request()
  // The view doesn't expose dbo.[Order].ID_Order directly; LEFT JOIN the base Order
  // table on the SAP ref so a queue row with no matching Order resolves with idOrder
  // NULL rather than dropping the row. Aliasing the view's existing columns keeps the
  // SELECT predictable.
  const result = await request.query<Record<string, unknown>>(
    `SELECT
       o.ID_Order,
       v.[Enc PHC] AS encPhc,
       v.[Data Pedido] AS orderDate,
       v.[Cliente] AS client,
       v.[Area] AS area,
       v.[Produto] AS product,
       v.[Tipo] AS type,
       v.[Preço de Venda] AS sellPrice,
       v.[Valor Reconhecido] AS recognizedValue,
       v.[Valor por Reconhecer] AS remainingValue,
       v.[Facturado] AS invoiced
     FROM [${ORDERS_SCHEMA}].[${RECOGNITION_BACKLOG_VIEW}] AS v
     LEFT JOIN [${ORDERS_SCHEMA}].[${ORDERS_TABLE}] AS o ON o.Encomenda_Cli_PHC = v.[Enc PHC]
     WHERE COALESCE(v.[Valor por Reconhecer], 0) > 0
     ORDER BY v.[Data Pedido] DESC, v.[Valor por Reconhecer] DESC`,
  )
  return result.recordset.map(toDashboardRecognitionQueueRow)
}

function buildDashboardTrend(
  rows: Record<string, unknown>[],
  year: number,
  currentMonth: number,
): DashboardSnapshotRow['monthlyTrend'] {
  const byMonth = new Map(
    rows.map((row) => [numberOrNull(row.month_num) ?? 0, row] as const),
  )
  return Array.from({ length: currentMonth }, (_, index) => {
    const month = index + 1
    const row = byMonth.get(month)
    return {
      monthStart: new Date(Date.UTC(year, index, 1)).toISOString(),
      revenue: numberOrNull(row?.revenue) ?? 0,
      nob: numberOrNull(row?.nob) ?? 0,
    }
  })
}

// Queue rows come from a legacy view with spaces/accents in the column names. Alias them to
// stable camelCase API fields here so the frontend never has to deal with bracketed SQL names.
function toDashboardRecognitionQueueRow(row: Record<string, unknown>): DashboardRecognitionQueueRow {
  return {
    idOrder: numberOrNull(row.ID_Order),
    encPhc: stringOrNull(row.encPhc),
    orderDate: dateTimeOrNull(row.orderDate),
    client: stringOrNull(row.client),
    area: stringOrNull(row.area),
    product: stringOrNull(row.product),
    type: stringOrNull(row.type),
    sellPrice: numberOrNull(row.sellPrice),
    recognizedValue: numberOrNull(row.recognizedValue),
    remainingValue: numberOrNull(row.remainingValue),
    invoiced: booleanOrNull(row.invoiced),
  }
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
  // Defense-in-depth: the UI picker only offers existing clients, but the server rejects an
  // unknown ID_Client before attempting the INSERT (the Order table has no FK constraint, so
  // SQL Server would otherwise happily store a dangling client id).
  const existsRequest = pool.request()
  existsRequest.input('ID_Cliente', mssql.Int, input.ID_Client)
  const exists = await existsRequest.query<{ '': unknown }>(
    `SELECT TOP 1 1 FROM [${ORDERS_SCHEMA}].[${CLIENT_TABLE}] WHERE ID_Cliente = @ID_Cliente`,
  )
  if (!exists.recordset[0]) throw new ClientNotFoundError(input.ID_Client)

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

// Creates a row in dbo.Client. Required fields (nome, morada, local, codpost, no_PHC,
// ncont, ID_Tp_Cliente) are inserted unconditionally; optional fields are inserted only
// when present in the input. `ID_Cliente` is identity-assigned by SQL Server, so the
// route re-reads via fetchClientById to return the full detail row. Returns the
// created row (never null on success — the post-insert re-read is expected to find
// the row we just wrote).
export async function createClient(
  pool: ConnectionPool,
  input: ClientCreateInput,
): Promise<ClientDetailRow> {
  const request = pool.request()

  const requiredColumns: Array<{ column: string; value: string | number | null }> = [
    { column: 'nome', value: input.nome },
    { column: 'morada', value: input.morada },
    { column: 'local', value: input.local },
    { column: 'codpost', value: input.codpost },
    { column: 'no_PHC', value: input.no_PHC },
    { column: 'ncont', value: input.ncont },
    { column: 'ID_Tp_Cliente', value: input.ID_Tp_Cliente },
  ]

  const columns: string[] = []
  const values: string[] = []
  for (const { column, value } of requiredColumns) {
    columns.push(column)
    values.push(`@${column}`)
    request.input(column, column === 'no_PHC' || column === 'ID_Tp_Cliente' ? mssql.Int : mssql.NVarChar, value)
  }

  const optionalByColumn: Record<string, string | null | undefined> = {
    telefone: input.telefone,
    contacto: input.contacto,
    fax: input.fax,
    zona: input.zona,
  }
  for (const [column, value] of Object.entries(optionalByColumn)) {
    if (value === undefined || value === null || value === '') continue
    columns.push(column)
    values.push(`@${column}`)
    request.input(column, mssql.NVarChar, value)
  }

  const result = await request.query<{ ID_Cliente: number }>(
    `INSERT INTO [${ORDERS_SCHEMA}].[${CLIENT_TABLE}] (${columns.join(', ')})
     OUTPUT INSERTED.ID_Cliente
     VALUES (${values.join(', ')})`,
  )
  const id = result.recordset[0]?.ID_Cliente
  if (!id) throw new Error('The database did not return the new client identifier.')
  const created = await fetchClientById(pool, id)
  if (!created) throw new Error('The new client could not be read after creation.')
  return created
}

// Applies a partial UPDATE to dbo.Client. The SET clause is built ONLY from columns in
// UPDATEABLE_CLIENT_COLUMNS that are present in `changes` — column names are constants,
// never interpolated from input. The acting username is written to a per-row audit pair
// is not present on dbo.Client (verified 2026-08-24), so only the data columns are
// touched. Returns the re-read row, or null when the UPDATE affected 0 rows (the id was
// not found). The route enforces who may call this; the db layer just persists what it
// is given.
export async function updateClient(
  pool: ConnectionPool,
  id: number,
  changes: ClientUpdateChanges,
): Promise<ClientDetailRow | null> {
  const setClauses: string[] = []
  const request = pool.request()
  request.input('id', mssql.Int, id)

  for (const { column, type } of UPDATEABLE_CLIENT_COLUMNS) {
    if (column in changes) {
      setClauses.push(`${column} = @${column}`)
      request.input(column, type, (changes as Record<string, unknown>)[column])
    }
  }

  if (setClauses.length === 0) {
    // Nothing to change — return the current row so the route can respond 200.
    return fetchClientById(pool, id)
  }

  const sql = `UPDATE [${ORDERS_SCHEMA}].[${CLIENT_TABLE}]
    SET ${setClauses.join(', ')}
    WHERE ID_Cliente = @id`

  const result = await request.query(sql)
  if (result.rowsAffected[0] === 0) return null
  return fetchClientById(pool, id)
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

// Recognition report — reads every row from the year/month crosstab view
// `dbo.V_Reconhecimento_Monthly_Crosstab` and maps it to the camelCase wire
// shape the UI expects. Filters are bound as parameters (never interpolated)
// and the WHERE is built from the non-empty filters only; an empty `filters`
// object returns every row the view produces (subject to `limit`).
export interface RecognitionReportFilters {
  yearRecognition?: number[]
  area?: string[]
  grpReport?: string[]
  tipo?: string[]
  produto?: string[]
  encomendaCliPHC?: string[]
}

export async function fetchRecognitionReport(
  pool: ConnectionPool,
  filters: RecognitionReportFilters,
  limit: number,
): Promise<RecognitionReportRow[]> {
  const request = pool.request()
  const where: string[] = []

  if (filters.yearRecognition && filters.yearRecognition.length > 0) {
    where.push(
      `v.Year_Recognition IN (${placeholders('yearRecognition', filters.yearRecognition.length)})`,
    )
    filters.yearRecognition.forEach((value, index) => {
      request.input(`yearRecognition${index}`, mssql.Int, value)
    })
  }
  if (filters.area && filters.area.length > 0) {
    where.push(`v.Area IN (${placeholders('area', filters.area.length)})`)
    filters.area.forEach((value, index) => {
      request.input(`area${index}`, mssql.NVarChar, value)
    })
  }
  if (filters.grpReport && filters.grpReport.length > 0) {
    where.push(`v.Grp_Report IN (${placeholders('grpReport', filters.grpReport.length)})`)
    filters.grpReport.forEach((value, index) => {
      request.input(`grpReport${index}`, mssql.NVarChar, value)
    })
  }
  if (filters.tipo && filters.tipo.length > 0) {
    where.push(`v.Tipo IN (${placeholders('tipo', filters.tipo.length)})`)
    filters.tipo.forEach((value, index) => {
      request.input(`tipo${index}`, mssql.NVarChar, value)
    })
  }
  if (filters.produto && filters.produto.length > 0) {
    where.push(`v.Produto IN (${placeholders('produto', filters.produto.length)})`)
    filters.produto.forEach((value, index) => {
      request.input(`produto${index}`, mssql.NVarChar, value)
    })
  }
  if (filters.encomendaCliPHC && filters.encomendaCliPHC.length > 0) {
    where.push(
      `v.Encomenda_Cli_PHC IN (${placeholders('encomendaCliPHC', filters.encomendaCliPHC.length)})`,
    )
    filters.encomendaCliPHC.forEach((value, index) => {
      request.input(`encomendaCliPHC${index}`, mssql.NVarChar, value)
    })
  }

  request.input('limit', mssql.Int, limit)
  const result = await request.query<Record<string, unknown>>(
    `SELECT TOP (@limit)
       v.Year_Recognition,
       v.Area,
       v.Grp_Report,
       v.Tipo,
       v.Produto,
       v.Encomenda_Cli_PHC,
       v.Cliente,
       v.Sell_Price,
       v.Tp_Reconhecimento,
       v.January, v.February, v.March, v.April, v.May, v.June,
       v.July, v.August, v.September, v.October, v.November, v.December,
       v.Total_Year
     FROM [${ORDERS_SCHEMA}].[${RECOGNITION_MONTHLY_VIEW}] AS v
     ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY v.Year_Recognition DESC, v.Area ASC, v.Cliente ASC`,
  )
  return result.recordset.map(toRecognitionReportRow)
}

// Distinct values for every filterable dimension of the recognition report.
// Powers the filter-bar dropdowns on the UI side; counts are intentionally
// omitted because the only caller is the filter chip list.
export async function fetchRecognitionReportOptions(
  pool: ConnectionPool,
): Promise<RecognitionReportOptions> {
  const result = await pool.request().query<Record<string, unknown>>(
    `SELECT DISTINCT
       Year_Recognition,
       Area,
       Grp_Report,
       Tipo,
       Produto,
       Encomenda_Cli_PHC
     FROM [${ORDERS_SCHEMA}].[${RECOGNITION_MONTHLY_VIEW}]`,
  )
  const years = new Set<number>()
  const areas = new Set<string>()
  const grpReports = new Set<string>()
  const tipos = new Set<string>()
  const produtos = new Set<string>()
  const encomendas = new Set<string>()
  for (const row of result.recordset) {
    const year = numberOrNull(row.Year_Recognition)
    if (year != null) years.add(year)
    const area = stringOrNull(row.Area)
    if (area) areas.add(area)
    const grp = stringOrNull(row.Grp_Report)
    if (grp) grpReports.add(grp)
    const tipo = stringOrNull(row.Tipo)
    if (tipo) tipos.add(tipo)
    const produto = stringOrNull(row.Produto)
    if (produto) produtos.add(produto)
    const enc = stringOrNull(row.Encomenda_Cli_PHC)
    if (enc) encomendas.add(enc)
  }
  return {
    years: Array.from(years).sort((a, b) => b - a),
    areas: Array.from(areas).sort(),
    grpReports: Array.from(grpReports).sort(),
    tipos: Array.from(tipos).sort(),
    produtos: Array.from(produtos).sort(),
    encomendas: Array.from(encomendas).sort(),
  }
}

// Reference cascade: Área → Produto → Instrumento. The three tables are small and static, so the
// endpoints read them unpaginated. `fetchProdutos`/`fetchInstrumentos` accept an optional parent
// id to narrow the cascade; omitting it returns every row (used by the filters, which are not
// cascaded). Verified 2026-08-25 against BRKR_ERP (Produto.ID_Area, Instrumento.ID_Produto).
export async function fetchAreas(pool: ConnectionPool): Promise<AreaRow[]> {
  const result = await pool.request().query<Record<string, unknown>>(
    `SELECT ID_Area, Area FROM [${ORDERS_SCHEMA}].[Area] ORDER BY ID_Area ASC`,
  )
  return result.recordset.map((row) => ({
    id: stringOrNull(row.ID_Area) ?? '',
    label: stringOrNull(row.Area) ?? '',
  }))
}

export async function fetchProdutos(
  pool: ConnectionPool,
  area?: string,
): Promise<ProdutoRow[]> {
  const request = pool.request()
  const where = area ? 'WHERE ID_Area = @area' : ''
  if (area) request.input('area', mssql.NVarChar, area)
  const result = await request.query<Record<string, unknown>>(
    `SELECT ID_Produto, ID_Area, Produto FROM [${ORDERS_SCHEMA}].[Produto] ${where}
     ORDER BY ID_Produto ASC`,
  )
  return result.recordset.map((row) => ({
    id: numberOrNull(row.ID_Produto) ?? 0,
    label: stringOrNull(row.Produto) ?? '',
    area: stringOrNull(row.ID_Area),
  }))
}

export async function fetchInstrumentos(
  pool: ConnectionPool,
  produto?: number,
): Promise<InstrumentoRow[]> {
  const request = pool.request()
  const where = produto ? 'WHERE ID_Produto = @produto' : ''
  if (produto) request.input('produto', mssql.Int, produto)
  const result = await request.query<Record<string, unknown>>(
    `SELECT ID_Instrumento, ID_Produto, Instrumento FROM [${ORDERS_SCHEMA}].[Instrumento] ${where}
     ORDER BY ID_Instrumento ASC`,
  )
  return result.recordset.map((row) => ({
    id: numberOrNull(row.ID_Instrumento) ?? 0,
    label: stringOrNull(row.Instrumento) ?? '',
    produto: numberOrNull(row.ID_Produto),
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

// Thrown when a create request references a client id that does not exist in dbo.Client.
// Defense-in-depth: the UI picker only offers clients from the list, but the server rejects
// unknown ids regardless. Mapped to a 400 validation response — it is a caller input error,
// not a missing resource the caller already holds.
export class ClientNotFoundError extends Error {
  constructor(id: number) {
    super(`Client ${id} does not exist.`)
    this.name = 'ClientNotFoundError'
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

// Kit_Consumables sub-table CRUD. Unlike Reconhecimento there is no per-row capacity
// constraint (the Saldo = Kit_Amount − Σ Total_Price is a display-only figure), so the
// mutations are plain INSERT/UPDATE/DELETE without the lock-and-capacity transaction.
// Hard delete mirrors Reconhecimento — dbo.Kit_Consumables has no deleted_at column.
export async function fetchKitConsumables(
  pool: ConnectionPool,
  orderId: number,
): Promise<KitConsumableRow[]> {
  const request = pool.request()
  request.input('orderId', mssql.Int, orderId)
  const sql = `SELECT
    ID_Kit, ID_Order, Date, Internal_Order, Material, Description,
    Quant, Unit_Price, Total_Price
  FROM [${ORDERS_SCHEMA}].[${KIT_CONSUMABLES_TABLE}]
  WHERE ID_Order = @orderId
  ORDER BY ID_Kit ASC`

  const result = await request.query<Record<string, unknown>>(sql)
  return Array.from(result.recordset).map(toKitConsumableRow)
}

export async function addKitConsumable(
  pool: ConnectionPool,
  input: NewKitConsumableInput,
): Promise<KitConsumableRow> {
  const request = pool.request()
  request.input('orderId', mssql.Int, input.ID_Order)
  request.input('date', mssql.DateTime, input.Date)
  request.input('internalOrder', mssql.NVarChar, input.Internal_Order)
  request.input('material', mssql.NVarChar, input.Material)
  request.input('description', mssql.NVarChar, input.Description)
  request.input('quant', mssql.Int, input.Quant)
  request.input('unitPrice', mssql.Money, input.Unit_Price)
  request.input('totalPrice', mssql.Money, input.Total_Price)
  const inserted = await request.query<Record<string, unknown>>(
    `INSERT INTO [${ORDERS_SCHEMA}].[${KIT_CONSUMABLES_TABLE}]
      (ID_Order, Date, Internal_Order, Material, Description, Quant, Unit_Price, Total_Price)
     OUTPUT INSERTED.ID_Kit, INSERTED.ID_Order, INSERTED.Date,
            INSERTED.Internal_Order, INSERTED.Material, INSERTED.Description,
            INSERTED.Quant, INSERTED.Unit_Price, INSERTED.Total_Price
     VALUES (@orderId, @date, @internalOrder, @material, @description, @quant, @unitPrice, @totalPrice)`,
  )
  const row = inserted.recordset[0]
  if (!row) throw new Error('The database did not return the kit consumable row.')
  return toKitConsumableRow(row)
}

export async function updateKitConsumable(
  pool: ConnectionPool,
  id: number,
  patch: KitConsumablePatch,
): Promise<KitConsumableRow | null> {
  const request = pool.request()
  request.input('id', mssql.Int, id)
  const setClauses: string[] = []
  for (const { column, type: sqlType } of KIT_CONSUMABLES_UPDATEABLE_COLUMNS) {
    if (column in patch) {
      setClauses.push(`${column} = @${column}`)
      request.input(column, sqlType, patch[column])
    }
  }
  if (setClauses.length === 0) {
    // Nothing to change — return the current row so the route can respond 200.
    const current = await request.query<Record<string, unknown>>(
      `SELECT ID_Kit, ID_Order, Date, Internal_Order, Material, Description,
              Quant, Unit_Price, Total_Price
       FROM [${ORDERS_SCHEMA}].[${KIT_CONSUMABLES_TABLE}]
       WHERE ID_Kit = @id`,
    )
    return current.recordset[0] ? toKitConsumableRow(current.recordset[0]) : null
  }
  const updated = await request.query<Record<string, unknown>>(
    `UPDATE [${ORDERS_SCHEMA}].[${KIT_CONSUMABLES_TABLE}]
     SET ${setClauses.join(', ')}
     OUTPUT INSERTED.ID_Kit, INSERTED.ID_Order, INSERTED.Date,
            INSERTED.Internal_Order, INSERTED.Material, INSERTED.Description,
            INSERTED.Quant, INSERTED.Unit_Price, INSERTED.Total_Price
     WHERE ID_Kit = @id`,
  )
  const row = updated.recordset[0]
  return row ? toKitConsumableRow(row) : null
}

export async function deleteKitConsumable(pool: ConnectionPool, id: number): Promise<boolean> {
  const request = pool.request()
  request.input('id', mssql.Int, id)
  const result = await request.query(
    `DELETE FROM [${ORDERS_SCHEMA}].[${KIT_CONSUMABLES_TABLE}]
     WHERE ID_Kit = @id`,
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
  const recognitionDate = dateOrNull(input.recognitionDate)
  if (
    sellPrice === null ||
    sellPrice <= 0 ||
    start === null ||
    recognitionDate === null
  ) {
    throw new PropagationValidationError(
      'Sell Price, início do contrato e data de reconhecimento são obrigatórios.',
    )
  }
  const months = input.years * 12
  const values = allocateMoney(sellPrice, months)
  const contractStart = firstUtcMonth(start)
  const recognitionMonth = firstUtcMonth(recognitionDate)
  return values.map((value, index) => {
    const scheduled = addUtcMonths(contractStart, index)
    return {
      type: 'CM',
      date: scheduled.getTime() < recognitionMonth.getTime() ? recognitionMonth : scheduled,
      value,
    }
  })
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
    // Order-table-only columns joined from dbo.[Order]. When the LEFT JOIN found no base
    // row these come back null and render as "—" — they never break the list.
    Kit: booleanOrNull(row['Kit']),
    ID_Tp_Warranty: numberOrNull(row['ID_Tp_Warranty']),
    Warranty_Reserve: numberOrNull(row['Warranty_Reserve']),
    Warranty_DT_Inicio: dateTimeOrNull(row['Warranty_DT_Inicio']),
    Orc_Proposta: stringOrNull(row['Orc_Proposta']),
    PO_Cliente: stringOrNull(row['PO_Cliente']),
    ID_Tp_Revenue: numberOrNull(row['ID_Tp_Revenue']),
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

function toKitConsumableRow(row: Record<string, unknown>): KitConsumableRow {
  return {
    ID_Kit: numberOrThrow(row, 'ID_Kit'),
    ID_Order: numberOrThrow(row, 'ID_Order'),
    Date: dateTimeOrNull(row['Date']),
    Internal_Order: stringOrNull(row['Internal_Order']),
    Material: stringOrNull(row['Material']),
    Description: stringOrNull(row['Description']),
    Quant: numberOrNull(row['Quant']),
    Unit_Price: numberOrNull(row['Unit_Price']),
    Total_Price: numberOrNull(row['Total_Price']),
  }
}

// Builds "@name0, @name1, …" for a parameterized IN clause. The column name is a hardcoded
// constant (never user input), so only the parameter count is dynamic.
function placeholders(name: string, count: number): string {
  return Array.from({ length: count }, (_, index) => `@${name}${index}`).join(', ')
}

function toRecognitionReportRow(row: Record<string, unknown>): RecognitionReportRow {
  return {
    yearRecognition: numberOrNull(row.Year_Recognition),
    area: stringOrNull(row.Area),
    grpReport: stringOrNull(row.Grp_Report),
    tipo: stringOrNull(row.Tipo),
    produto: stringOrNull(row.Produto),
    encomendaCliPHC: stringOrNull(row.Encomenda_Cli_PHC),
    cliente: stringOrNull(row.Cliente),
    sellPrice: numberOrNull(row.Sell_Price),
    tpReconhecimento: stringOrNull(row.Tp_Reconhecimento),
    january: numberOrNull(row.January) ?? 0,
    february: numberOrNull(row.February) ?? 0,
    march: numberOrNull(row.March) ?? 0,
    april: numberOrNull(row.April) ?? 0,
    may: numberOrNull(row.May) ?? 0,
    june: numberOrNull(row.June) ?? 0,
    july: numberOrNull(row.July) ?? 0,
    august: numberOrNull(row.August) ?? 0,
    september: numberOrNull(row.September) ?? 0,
    october: numberOrNull(row.October) ?? 0,
    november: numberOrNull(row.November) ?? 0,
    december: numberOrNull(row.December) ?? 0,
    totalYear: numberOrNull(row.Total_Year) ?? 0,
  }
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
