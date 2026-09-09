import { createRequire } from 'node:module'
import type { ConnectionPool, ISqlType } from 'mssql'
import {
  booleanOrNull,
  MONEY_EPSILON,
  numberOrNull,
  stringOrNull,
} from '../sql-helpers.js'
import { addOrderFiltersInputs, buildOrderFiltersWhere } from './order-filters.sql.js'
import { toDetailRow, toSummaryRow } from '../row-mappers.js'
import type { OrderListFilters } from '../../types/filters.js'
import type {
  OrderCreateInput,
  OrderDetailRow,
  OrderFacetOption,
  OrderFacets,
  OrderSummaryRow,
  OrderUpdateChanges,
  ReconhecimentoRow,
  OrderPage,
  OrderPageRequest,
  OrderSortId,
} from '../../types/index.js'

const mssql = createRequire(import.meta.url)('mssql') as typeof import('mssql')

const ORDERS_SCHEMA = 'dbo'
const ORDERS_VIEW = 'V_Order_List'
const ORDERS_TABLE = 'Order'
const CLIENT_TABLE = 'Client'
const RECONHECIMENTO_TABLE = 'Reconhecimento'
const FACTURACAO_TABLE = 'Facturacao'

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
  { column: 'Email', type: mssql.NVarChar },
  { column: 'Contacto', type: mssql.NVarChar },
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

export class DatabaseRowNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DatabaseRowNotFoundError'
  }
}

export class ClientNotFoundError extends Error {
  constructor(id: number) {
    super(`Client ${id} does not exist.`)
    this.name = 'ClientNotFoundError'
  }
}

export async function fetchOrderSummaries(
  pool: ConnectionPool,
  filters: OrderListFilters,
  limit?: number,
  offset = 0,
): Promise<OrderSummaryRow[]> {
  const request = pool.request()
  addOrderFiltersInputs(request, filters)
  const whereClause = buildOrderFiltersWhere(filters, 'v')
  if (limit != null) {
    request.input('limit', mssql.Int, limit)
    request.input('offset', mssql.Int, offset)
  }
  const sql = `SELECT
    v.ID_Order, v.DT_Order, v.Order_Factory, v.ID_Tp_Order, v.ID_Client,
    v.nome AS Client_Name, v.ID_Area, v.ID_Tipo, v.ID_Produto, v.ID_Instrumento,
    v.Sell_Price, v.Negocio_Fechado, v.Encomenda_Cli_PHC, v.Provisoria,
    v.Tp_Order AS Tp_Order_Label, v.Area AS Area_Label, v.Tipo AS Tipo_Label,
    v.Produto AS Produto_Label, v.Instrumento AS Instrumento_Label,
    v.Tp_Warranty AS Tp_Warranty_Label, v.Tp_Revenue AS Tp_Revenue_Label,
    o.Kit, o.ID_Tp_Warranty, o.Warranty_Reserve, o.Warranty_DT_Inicio,
    o.Orc_Proposta, o.PO_Cliente, o.ID_Tp_Revenue
  FROM [${ORDERS_SCHEMA}].[${ORDERS_VIEW}] AS v
  LEFT JOIN [${ORDERS_SCHEMA}].[${ORDERS_TABLE}] AS o ON o.ID_Order = v.ID_Order
  ${whereClause ? `WHERE ${whereClause}` : ''}
  ORDER BY v.DT_Order DESC, v.ID_Order DESC
  ${limit != null ? 'OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY' : ''}`
  const result = await request.query<Record<string, unknown>>(sql)
  return Array.from(result.recordset).map(toSummaryRow)
}

const PAGE_SORT_COLUMNS: Record<OrderSortId, string> = {
  Encomenda_Cli_PHC: 'v.Encomenda_Cli_PHC',
  Order_Factory: 'v.Order_Factory',
  Kit: 'o.Kit',
  DT_Order: 'v.DT_Order',
  ID_Order: 'v.ID_Order',
  Client_Name: 'v.nome',
  Sell_Price: 'v.Sell_Price',
  ID_Client: 'v.ID_Client',
  ID_Tp_Order: 'v.ID_Tp_Order',
  ID_Area: 'v.ID_Area',
  ID_Tipo: 'v.ID_Tipo',
  ID_Produto: 'v.ID_Produto',
  ID_Instrumento: 'v.ID_Instrumento',
  Negocio_Fechado: 'v.Negocio_Fechado',
  ID_Tp_Warranty: 'o.ID_Tp_Warranty',
  Warranty_Reserve: 'o.Warranty_Reserve',
  Warranty_DT_Inicio: 'o.Warranty_DT_Inicio',
  Orc_Proposta: 'o.Orc_Proposta',
  PO_Cliente: 'o.PO_Cliente',
  ID_Tp_Revenue: 'o.ID_Tp_Revenue',
}

export function encodeOrderCursor(date: string, id: number): string {
  return Buffer.from(JSON.stringify({ date, id }), 'utf8').toString('base64url')
}

export function decodeOrderCursor(cursor: string): { date: string; id: number } {
  let value: unknown
  try {
    value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
  } catch {
    throw new Error('The order cursor is invalid.')
  }
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as { date?: unknown }).date !== 'string' ||
    !Number.isInteger((value as { id?: unknown }).id) ||
    ((value as { id: number }).id <= 0)
  ) {
    throw new Error('The order cursor is invalid.')
  }
  return value as { date: string; id: number }
}

export async function fetchPagedOrderSummaries(
  pool: ConnectionPool,
  input: OrderPageRequest,
): Promise<OrderPage> {
  const request = pool.request()
  addOrderFiltersInputs(request, input.filters)
  const where = buildOrderFiltersWhere(input.filters, 'v')
  const totalWhere = buildOrderFiltersWhere(input.filters, 'v2')
  const defaultSort = input.sort.id === 'DT_Order'
  const includeTotal = !input.cursor && (input.offset ?? 0) === 0
  const sortColumn = PAGE_SORT_COLUMNS[input.sort.id]
  const direction = input.sort.direction.toUpperCase()
  const tieDirection = direction
  let paging = ''

  if (defaultSort && input.cursor) {
    const cursor = decodeOrderCursor(input.cursor)
    request.input('cursorDate', mssql.NVarChar, cursor.date)
    request.input('cursorId', mssql.Int, cursor.id)
    paging = input.sort.direction === 'desc'
      ? ' AND (v.DT_Order < @cursorDate OR (v.DT_Order = @cursorDate AND v.ID_Order < @cursorId))'
      : ' AND (v.DT_Order > @cursorDate OR (v.DT_Order = @cursorDate AND v.ID_Order > @cursorId))'
  } else {
    request.input('offset', mssql.Int, input.offset ?? 0)
  }
  request.input('pageLimit', mssql.Int, input.limit + 1)
  const sql = `SELECT ${defaultSort && input.cursor ? 'TOP (@pageLimit)' : ''}
    v.ID_Order, v.DT_Order, v.Order_Factory, v.ID_Tp_Order, v.ID_Client,
    v.nome AS Client_Name, v.ID_Area, v.ID_Tipo, v.ID_Produto, v.ID_Instrumento,
    v.Sell_Price, v.Negocio_Fechado, v.Encomenda_Cli_PHC, v.Provisoria,
    v.Tp_Order AS Tp_Order_Label, v.Area AS Area_Label, v.Tipo AS Tipo_Label,
    v.Produto AS Produto_Label, v.Instrumento AS Instrumento_Label,
    v.Tp_Warranty AS Tp_Warranty_Label, v.Tp_Revenue AS Tp_Revenue_Label,
    o.Kit, o.ID_Tp_Warranty, o.Warranty_Reserve, o.Warranty_DT_Inicio,
    o.Orc_Proposta, o.PO_Cliente, o.ID_Tp_Revenue,
    ${includeTotal ? `(SELECT COUNT(*) FROM [${ORDERS_SCHEMA}].[${ORDERS_VIEW}] AS v2
     ${totalWhere ? `WHERE ${totalWhere}` : ''}) AS __total` : 'CAST(NULL AS int) AS __total'}
  FROM [${ORDERS_SCHEMA}].[${ORDERS_VIEW}] AS v
  LEFT JOIN [${ORDERS_SCHEMA}].[${ORDERS_TABLE}] AS o ON o.ID_Order = v.ID_Order
  ${where || paging ? `WHERE ${[where, paging.replace(/^ AND /, '')].filter(Boolean).join(' AND ')}` : ''}
  ORDER BY ${sortColumn} ${direction}, v.ID_Order ${tieDirection}
  ${defaultSort && input.cursor ? '' : 'OFFSET @offset ROWS FETCH NEXT @pageLimit ROWS ONLY'}`
  const result = await request.query<Record<string, unknown>>(sql)
  const hasNext = result.recordset.length > input.limit
  const rows = result.recordset.slice(0, input.limit)
  const items = rows.map(toSummaryRow)
  const last = items.at(-1)
  return {
    items,
    total: Number(result.recordset[0]?.__total ?? 0),
    nextCursor: hasNext && last ? encodeOrderCursor(last.DT_Order, last.ID_Order) : null,
  }
}

/**
 * Faceted option set for a single dimension. The query is built against
 * `V_Order_List` (the same projection `fetchOrderSummaries` reads from) so a
 * facet option exists only when at least one Order in the current filtered
 * universe carries that value. Labels come from the view itself, never from a
 * separate master-data read — see AGENT.md §11.
 *
 * `extraJoin` lets the product / instrument facets pull the master hierarchy
 * columns (`Produto.ID_Area`, `Instrumento.ID_Produto`) so the same WHERE
 * filters that reach the Orders propagate through to the children (Area ->
 * Product -> Instrument) without us inventing foreign keys.
 */
type FacetSpec = {
  facet: keyof OrderFacets
  excluded: import('./order-filters.sql.js').OrderFilterKey
  idExpr: string
  labelExpr: string
  orderBy: string
  extraJoin?: string
}

const FACETS: readonly FacetSpec[] = [
  {
    facet: 'idTpOrder',
    excluded: 'idTpOrder',
    idExpr: 'v.ID_Tp_Order',
    labelExpr: 'v.Tp_Order',
    orderBy: 'v.ID_Tp_Order',
  },
  {
    facet: 'idArea',
    excluded: 'idArea',
    idExpr: 'v.ID_Area',
    labelExpr: 'v.Area',
    orderBy: 'v.ID_Area',
  },
  {
    facet: 'idTipo',
    excluded: 'idTipo',
    idExpr: 'v.ID_Tipo',
    labelExpr: 'v.Tipo',
    orderBy: 'v.ID_Tipo',
  },
  {
    facet: 'idProduto',
    excluded: 'idProduto',
    idExpr: 'v.ID_Produto',
    labelExpr: 'v.Produto',
    orderBy: 'v.ID_Produto',
    extraJoin: `LEFT JOIN [${ORDERS_SCHEMA}].[Produto] AS p ON p.ID_Produto = v.ID_Produto`,
  },
  {
    facet: 'idInstrumento',
    excluded: 'idInstrumento',
    idExpr: 'v.ID_Instrumento',
    labelExpr: 'v.Instrumento',
    orderBy: 'v.ID_Instrumento',
    extraJoin: [
      `LEFT JOIN [${ORDERS_SCHEMA}].[Produto] AS p ON p.ID_Produto = v.ID_Produto`,
      `LEFT JOIN [${ORDERS_SCHEMA}].[Instrumento] AS i ON i.ID_Instrumento = v.ID_Instrumento`,
    ].join('\n'),
  },
]

export async function fetchOrderFacets(
  pool: ConnectionPool,
  filters: OrderListFilters,
): Promise<OrderFacets> {
  // One mssql request per facet so each builds its own bound parameters and
  // each can pass a different `excluded` value to the shared WHERE builder.
  // The 5 facets share `addOrderFiltersInputs` + `buildOrderFiltersWhere`
  // with `fetchOrderSummaries`, guaranteeing the option set cannot drift
  // from the row set (faceted semantics).
  const result: Record<keyof OrderFacets, OrderFacetOption[]> = {
    idTpOrder: [],
    idArea: [],
    idTipo: [],
    idProduto: [],
    idInstrumento: [],
  }
  for (const spec of FACETS) {
    const request = pool.request()
    addOrderFiltersInputs(request, filters)
    const where = buildOrderFiltersWhere(filters, 'v', spec.excluded)
    const sql = [
      `SELECT DISTINCT ${spec.idExpr} AS id, ${spec.labelExpr} AS label`,
      `FROM [${ORDERS_SCHEMA}].[${ORDERS_VIEW}] AS v`,
      spec.extraJoin ?? '',
      where ? `WHERE ${where}` : '',
      `ORDER BY ${spec.orderBy}`,
    ]
      .filter(Boolean)
      .join('\n')
    const rows = await request.query<Record<string, unknown>>(sql)
    result[spec.facet] = toFacetOptions(rows.recordset)
  }
  return result
}

function toFacetOptions(rows: readonly Record<string, unknown>[] | undefined): OrderFacetOption[] {
  return (rows ?? [])
    .map((row) => ({ id: row.id as string | number, label: stringOrNull(row.label) }))
    .filter((row) => row.id !== null && row.id !== undefined)
}

export async function fetchOrderById(
  pool: ConnectionPool,
  id: number,
): Promise<OrderDetailRow | null> {
  const request = pool.request()
  request.input('id', mssql.Int, id)
  const sql = `SELECT
    o.ID_Order, o.DT_Order, o.Order_Factory, o.ID_Tp_Order, o.Encomenda_Cli_PHC, o.ID_Client,
    c.nome AS Client_Name, o.ID_Area, o.ID_Tipo, t.Warranty AS Tipo_Warranty,
    o.ID_Produto, o.ID_Instrumento,
    v.Tp_Order AS Tp_Order_Label, v.Area AS Area_Label, v.Tipo AS Tipo_Label,
    v.Produto AS Produto_Label, v.Instrumento AS Instrumento_Label,
    v.Tp_Warranty AS Tp_Warranty_Label, v.Tp_Revenue AS Tp_Revenue_Label,
    o.Orc_Proposta, o.PO_Cliente, o.Sell_Price, o.ID_Tp_Warranty,
    o.Warranty_Reserve, o.Warranty_DT_Inicio, o.ID_Tp_Revenue, o.Facturado,
    o.Reconhecido, o.Cod_Enc_Fornecedor, o.Obs, o.Negocio_Fechado, o.ID_User,
    o.DT_User, o.Kit, o.Kit_Amount, o.Contacto, o.Email, o.Audit, v.Provisoria AS Provisoria
  FROM [${ORDERS_SCHEMA}].[${ORDERS_TABLE}] AS o
  LEFT JOIN [${ORDERS_SCHEMA}].[${CLIENT_TABLE}] AS c ON o.ID_Client = c.ID_Cliente
  LEFT JOIN [${ORDERS_SCHEMA}].[Tipo] AS t ON o.ID_Tipo = t.ID_Tipo
  LEFT JOIN [${ORDERS_SCHEMA}].[${ORDERS_VIEW}] AS v ON v.ID_Order = o.ID_Order
  WHERE o.ID_Order = @id`
  const result = await request.query<Record<string, unknown>>(sql)
  if (result.recordset.length === 0) return null
  return toDetailRow(result.recordset[0])
}

export async function appendOrderAudit(
  pool: ConnectionPool,
  id: number,
  entry: string,
  user: string,
): Promise<boolean> {
  const request = pool.request()
  request.input('id', mssql.Int, id)
  request.input('entry', mssql.NVarChar, entry)
  request.input('user', mssql.NVarChar, user)
  const result = await request.query(`UPDATE [${ORDERS_SCHEMA}].[${ORDERS_TABLE}]
    SET Audit = CONVERT(ntext, CONCAT(
      COALESCE(CAST(Audit AS nvarchar(max)), N''),
      CASE WHEN Audit IS NULL OR DATALENGTH(Audit) = 0 THEN N'' ELSE NCHAR(13) + NCHAR(10) END,
      @entry
    )), ID_User = @user, DT_User = GETUTCDATE()
    WHERE ID_Order = @id`)
  return (result.rowsAffected[0] ?? 0) > 0
}

export async function updateOrder(
  pool: ConnectionPool,
  id: number,
  changes: OrderUpdateChanges,
): Promise<OrderDetailRow | null> {
  if ('Sell_Price' in changes || 'Warranty_Reserve' in changes || 'ID_Tipo' in changes) {
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
  setClauses.push('ID_User = @user')
  setClauses.push('DT_User = GETUTCDATE()')
  const result = await request.query(`UPDATE [${ORDERS_SCHEMA}].[${ORDERS_TABLE}]
    SET ${setClauses.join(', ')}
    WHERE ID_Order = @id`)
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
    const updated = await request.query(`UPDATE [${ORDERS_SCHEMA}].[${ORDERS_TABLE}]
       SET ${setClauses.join(', ')}
       WHERE ID_Order = @id`)
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
  const existsRequest = pool.request()
  existsRequest.input('ID_Cliente', mssql.Int, input.ID_Client)
  const exists = await existsRequest.query<{ '': unknown }>(
    `SELECT TOP 1 1 FROM [${ORDERS_SCHEMA}].[${CLIENT_TABLE}] WHERE ID_Cliente = @ID_Cliente`,
  )
  if (!exists.recordset[0]) throw new ClientNotFoundError(input.ID_Client)
  const request = pool.request()
  request.input('DT_Order', mssql.DateTime, input.DT_Order ?? new Date())
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

export async function updateOrderWarrantyYears(
  pool: ConnectionPool,
  id: number,
  years: number,
  user: string,
): Promise<boolean> {
  const transaction = pool.transaction()
  await transaction.begin()
  try {
    const lookup = await transaction
      .request()
      .input('id', mssql.Int, id)
      .query<Record<string, unknown>>(
        `SELECT ID_Tp_Warranty FROM [${ORDERS_SCHEMA}].[${ORDERS_TABLE}] WHERE ID_Order = @id`,
      )
    let idTpWarranty = numberOrNull(lookup.recordset[0]?.ID_Tp_Warranty)
    if (idTpWarranty == null) {
      const warrantyType = await transaction
        .request()
        .input('years', mssql.Int, years)
        .query<Record<string, unknown>>(
          `SELECT TOP 1 ID_Tp_Warranty
         FROM [${ORDERS_SCHEMA}].[Tp_Warranty]
         WHERE N_Anos = @years
         ORDER BY ID_Tp_Warranty`,
        )
      idTpWarranty = numberOrNull(warrantyType.recordset[0]?.ID_Tp_Warranty)
      if (idTpWarranty == null) {
        await transaction.rollback()
        return false
      }
      const orderUpdate = await transaction
        .request()
        .input('id', mssql.Int, id)
        .input('idTpWarranty', mssql.Int, idTpWarranty)
        .input('user', mssql.NVarChar, user).query(`UPDATE [${ORDERS_SCHEMA}].[${ORDERS_TABLE}]
         SET ID_Tp_Warranty = @idTpWarranty, ID_User = @user, DT_User = GETUTCDATE()
         WHERE ID_Order = @id`)
      if ((orderUpdate.rowsAffected[0] ?? 0) === 0) {
        await transaction.rollback()
        return false
      }
    }
    await transaction
      .request()
      .input('idTpWarranty', mssql.Int, idTpWarranty)
      .input('years', mssql.Int, years)
      .input('user', mssql.NVarChar, user).query(`UPDATE [${ORDERS_SCHEMA}].[Tp_Warranty]
       SET N_Anos = @years, ID_User = @user, DT_User = GETUTCDATE()
       WHERE ID_Tp_Warranty = @idTpWarranty`)
    await transaction.commit()
    return true
  } catch (error) {
    await transaction.rollback()
    throw error
  }
}

type TransactionLike = ReturnType<ConnectionPool['transaction']>
type RecognitionCapacityRow = Pick<
  ReconhecimentoRow,
  'ID_Tp_Reconhecimento' | 'Valor_Reconhecimento'
>

export async function lockRecognitionOrder(
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

export async function readRecognitionCapacityRows(
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

export function assertRecognitionCapacity(
  order: Record<string, unknown>,
  existingRows: RecognitionCapacityRow[],
  candidateType: string,
  candidateValue: number,
): void {
  const sellPrice = numberOrNull(order.Sell_Price)
  if (sellPrice === null)
    throw new RecognitionCapacityError('O Sell Price é obrigatório para reconhecer valores.')
  const warrantyReserve =
    booleanOrNull(order.Tipo_Warranty) === true ? (numberOrNull(order.Warranty_Reserve) ?? 0) : 0
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
  if (total > sellPrice + MONEY_EPSILON)
    throw new RecognitionCapacityError('O total reconhecido não pode ultrapassar o Sell Price.')
  if (warranty > warrantyReserve + MONEY_EPSILON)
    throw new RecognitionCapacityError(
      'O total reconhecido em garantia não pode ultrapassar a Warranty Reserve.',
    )
  if (instrument > sellPrice - warrantyReserve + MONEY_EPSILON)
    throw new RecognitionCapacityError(
      'O valor reservado para garantia não pode ser reconhecido com outro tipo de reconhecimento.',
    )
}

export function assertExistingRecognitionCapacity(
  order: Record<string, unknown>,
  existingRows: RecognitionCapacityRow[],
): void {
  if (existingRows.some((row) => (row.Valor_Reconhecimento ?? 0) !== 0))
    assertRecognitionCapacity(order, existingRows, '', 0)
}

export function assertExistingInvoicingCapacity(
  order: Record<string, unknown>,
  existingRows: Array<{ Valor_Doc_FT: number | null }>,
): void {
  if (!existingRows.some((row) => (row.Valor_Doc_FT ?? 0) !== 0)) return
  const sellPrice = numberOrNull(order.Sell_Price)
  if (sellPrice === null)
    throw new FacturacaoCapacityError('O Sell Price é obrigatório para faturar valores.')
  assertInvoicingCapacity(sellPrice, existingRows, 0)
}

function isWarrantyRecognitionType(type: unknown): boolean {
  return type === 'W' || type === 'WP'
}

export async function readInvoicingCapacityRows(
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

export function assertInvoicingCapacity(
  sellPrice: number,
  existingRows: Array<{ Valor_Doc_FT: number | null }>,
  candidateValue: number,
): void {
  const currentNet = existingRows.reduce((sum, row) => sum + (row.Valor_Doc_FT ?? 0), 0)
  if (currentNet + candidateValue > sellPrice + MONEY_EPSILON)
    throw new FacturacaoCapacityError('O net faturado não pode ultrapassar o Sell Price.')
}
