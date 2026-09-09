import { createRequire } from 'node:module'
import type { ConnectionPool } from 'mssql'
import { numberOrNull, stringOrNull } from './sql-helpers.js'
import { toFacturacaoRow } from './row-mappers.js'
import {
  assertInvoicingCapacity,
  DatabaseRowNotFoundError,
  FacturacaoCapacityError,
  readInvoicingCapacityRows,
} from './orders/orders.repository.js'
import type {
  DocumentoFaturacaoRow,
  DocumentoFaturacaoTypeRow,
  FacturacaoPatch,
  NewFacturacaoInput,
} from '../types.js'

const mssql = createRequire(import.meta.url)('mssql') as typeof import('mssql')
const ORDERS_SCHEMA = 'dbo'
const ORDERS_TABLE = 'Order'
const FACTURACAO_TABLE = 'Facturacao'
const FACTURACAO_UPDATEABLE_COLUMNS = [
  { column: 'DT_Doc_FT' as const, type: mssql.DateTime },
  { column: 'ID_Tp_Doc_FT' as const, type: mssql.NVarChar },
  { column: 'N_Doc_FT' as const, type: mssql.NVarChar },
  { column: 'Valor_Doc_FT' as const, type: mssql.Money },
  { column: 'Imprimiu' as const, type: mssql.Bit },
  { column: 'Imp_Block' as const, type: mssql.Bit },
  { column: 'Nome_PDF' as const, type: mssql.NVarChar },
  { column: 'E_Invoice' as const, type: mssql.Bit },
]

export async function fetchFacturacao(
  pool: ConnectionPool,
  orderId: number,
): Promise<DocumentoFaturacaoRow[]> {
  const request = pool.request()
  request.input('orderId', mssql.Int, orderId)
  const sql = `SELECT
    ID_Facturacao, ID_Order, DT_Doc_FT, ID_Tp_Doc_FT, N_Doc_FT,
    Valor_Doc_FT, ID_User, DT_User, Imprimiu, Imp_Block, Nome_PDF, E_Invoice
  FROM [${ORDERS_SCHEMA}].[${FACTURACAO_TABLE}]
  WHERE ID_Order = @orderId
  ORDER BY ID_Facturacao ASC`
  const result = await request.query<Record<string, unknown>>(sql)
  return Array.from(result.recordset).map(toFacturacaoRow)
}

export async function fetchAllFacturacao(
  pool: ConnectionPool,
  filters: { from?: string; to?: string } = {},
): Promise<DocumentoFaturacaoRow[]> {
  const request = pool.request()
  request.input('fromDate', mssql.DateTime, filters.from ?? null)
  request.input('toDate', mssql.DateTime, filters.to ? `${filters.to}T23:59:59.997` : null)
  const result = await request.query<Record<string, unknown>>(`SELECT
    f.ID_Facturacao, f.ID_Order, f.DT_Doc_FT, f.ID_Tp_Doc_FT, f.N_Doc_FT,
    f.Valor_Doc_FT, f.ID_User, f.DT_User, f.Imprimiu, f.Imp_Block, f.Nome_PDF, f.E_Invoice,
    o.Encomenda_Cli_PHC AS SAP_Order_Number, c.nome AS Client_Name, o.Email AS Order_Email,
    o.Contacto AS Order_Contact, o.PO_Cliente AS Order_PO
  FROM [${ORDERS_SCHEMA}].[${FACTURACAO_TABLE}] AS f
  LEFT JOIN [${ORDERS_SCHEMA}].[${ORDERS_TABLE}] AS o ON o.ID_Order = f.ID_Order
  LEFT JOIN [${ORDERS_SCHEMA}].[Client] AS c ON c.ID_Cliente = o.ID_Client
  WHERE (@fromDate IS NULL OR f.DT_Doc_FT >= @fromDate)
    AND (@toDate IS NULL OR f.DT_Doc_FT <= @toDate)
  ORDER BY f.DT_Doc_FT ASC, f.ID_Facturacao ASC`)
  return result.recordset.map((row) => ({ ...toFacturacaoRow(row), SAP_Order_Number: stringOrNull(row.SAP_Order_Number), Client_Name: stringOrNull(row.Client_Name), Order_Email: stringOrNull(row.Order_Email), Order_Contact: stringOrNull(row.Order_Contact), Order_PO: stringOrNull(row.Order_PO) }))
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
               INSERTED.ID_User, INSERTED.DT_User, INSERTED.Imprimiu, INSERTED.Imp_Block,
               INSERTED.Nome_PDF, INSERTED.E_Invoice
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
      `SELECT ID_Order FROM [${ORDERS_SCHEMA}].[${FACTURACAO_TABLE}] WHERE ID_Facturacao = @id`,
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
              Valor_Doc_FT, ID_User, DT_User, Imprimiu, Imp_Block, Nome_PDF, E_Invoice
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
               INSERTED.ID_User, INSERTED.DT_User, INSERTED.Imprimiu, INSERTED.Imp_Block,
               INSERTED.Nome_PDF, INSERTED.E_Invoice
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
    `DELETE FROM [${ORDERS_SCHEMA}].[${FACTURACAO_TABLE}] WHERE ID_Facturacao = @id`,
  )
  return (result.rowsAffected[0] ?? 0) > 0
}

type TransactionLike = ReturnType<ConnectionPool['transaction']>
async function lockInvoicingOrder(transaction: TransactionLike, orderId: number): Promise<number> {
  const request = transaction.request()
  request.input('orderId', mssql.Int, orderId)
  const result = await request.query<Record<string, unknown>>(
    `SELECT Sell_Price
     FROM [${ORDERS_SCHEMA}].[${ORDERS_TABLE}] WITH (UPDLOCK, HOLDLOCK)
     WHERE ID_Order = @orderId`,
  )
  if (!result.recordset[0]) throw new DatabaseRowNotFoundError(`Order ${orderId} was not found.`)
  const sellPrice = numberOrNull(result.recordset[0].Sell_Price)
  if (sellPrice === null)
    throw new FacturacaoCapacityError('O Sell Price é obrigatório para faturar valores.')
  return sellPrice
}
