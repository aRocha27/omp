import { createRequire } from 'node:module'
import type { ConnectionPool } from 'mssql'
import { booleanOrNull, dateTimeOrNull, numberOrNull, stringOrNull } from './repositories/sql-helpers.js'
import {
  fetchNotFullyInvoiced,
  fetchPendingRecognition,
  fetchPendingRecognitionCount,
  fetchWarrantyMissing,
} from './repositories/dashboard.repository.js'
import type { InvoicingSnapshotRow, UtilizadorRow } from './types.js'

const mssql = createRequire(import.meta.url)('mssql') as typeof import('mssql')
const ORDERS_SCHEMA = 'dbo'

export {
  fetchOrderById,
  fetchOrderFacets,
  fetchOrderSummaries,
  fetchPagedOrderSummaries,
  createOrder,
  updateOrder,
  updateOrderWarrantyYears,
  appendOrderAudit,
  RecognitionCapacityError,
  FacturacaoCapacityError,
  DatabaseRowNotFoundError,
  ClientNotFoundError,
} from './repositories/orders/orders.repository.js'

export {
  createClient,
  fetchClientById,
  fetchClientSummaries,
  updateClient,
} from './repositories/clients.repository.js'

export {
  fetchAreas,
  fetchInstrumentos,
  fetchProdutos,
} from './repositories/reference.repository.js'

export {
  fetchDashboardSnapshot,
  fetchRecognitionQueue,
  fetchPendingRecognition,
  fetchPendingRecognitionCount,
  fetchNotFullyInvoiced,
  fetchNotFullyInvoicedCount,
  fetchWarrantyMissing,
  fetchWarrantyMissingCount,
} from './repositories/dashboard.repository.js'
export {
  fetchRecognitionReport,
  fetchRecognitionReportOptions,
  fetchRecognitionReportFacets,
} from './repositories/recognition-report.repository.js'
export type { RecognitionReportFilters } from './repositories/recognition-report.repository.js'
export { fetchBacklogReport, fetchBacklogTodayReport, fetchBacklogYearlyTodayReport } from './repositories/report.repository.js'

export * from './repositories/reconhecimento.repository.js'
export * from './repositories/facturacao.repository.js'
export * from './repositories/kit-consumables.repository.js'

export {
  IDENTIFIER_PATTERN,
  TABLES_QUERY,
  TableUnavailableError,
  buildSqlConfig,
  openPool,
  listTables,
  fetchRows,
  fetchAllTables,
} from './repositories/database.js'

export type { ClientListFilters, OrderListFilters } from './types/filters.js'

export async function fetchInvoicingSnapshot(pool: ConnectionPool): Promise<InvoicingSnapshotRow> {
  const [notFullyInvoiced, warrantyMissing, pendingRecognition, pendingRecognitionTotal] = await Promise.all([
    fetchNotFullyInvoiced(pool),
    fetchWarrantyMissing(pool),
    fetchPendingRecognition(pool),
    fetchPendingRecognitionCount(pool),
  ])

  return {
    amountToInvoice: notFullyInvoiced.reduce((sum, row) => sum + (row.diferenca ?? 0), 0),
    notFullyInvoiced,
    warrantyMissing,
    pendingRecognition,
    pendingRecognitionTotal,
  }
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

export async function findAuthUser(pool: ConnectionPool, username: string): Promise<UtilizadorRow | null> {
  const request = pool.request()
  request.input('username', mssql.NVarChar(30), username)
  const result = await request.query<Record<string, unknown>>(
    `SELECT TOP 1 ID_User, User_Name, Read_Only, Admin, Cancelado, Pwd, DT_Last_Login,
      DT_Changed_Psw, Fail_Login, NewUser FROM [${ORDERS_SCHEMA}].[Utilizador]
      WHERE ID_User = @username`,
  )
  const row = result.recordset[0]
  if (!row) return null
  return {
    ID_User: stringOrNull(row.ID_User) ?? '', User_Name: stringOrNull(row.User_Name),
    Read_Only: booleanOrNull(row.Read_Only), Admin: booleanOrNull(row.Admin), DT_Criacao: null,
    Cancelado: booleanOrNull(row.Cancelado), DT_Cancelado: null, Obs: null,
    Pwd: stringOrNull(row.Pwd), DT_Last_Login: dateTimeOrNull(row.DT_Last_Login),
    DT_Changed_Psw: dateTimeOrNull(row.DT_Changed_Psw), Fail_Login: numberOrNull(row.Fail_Login),
    NewUser: booleanOrNull(row.NewUser),
  }
}

export async function updateAuthFailure(pool: ConnectionPool, username: string): Promise<void> {
  const request = pool.request(); request.input('username', mssql.NVarChar(30), username)
  await request.query(`UPDATE [${ORDERS_SCHEMA}].[Utilizador] SET Fail_Login = COALESCE(Fail_Login, 0) + 1 WHERE ID_User = @username`)
}

export async function setPassword(pool: ConnectionPool, id: string, hash: string, firstLogin: boolean): Promise<void> {
  const request = pool.request(); request.input('id', mssql.NVarChar(30), id); request.input('hash', mssql.NVarChar(100), hash)
  await request.query(`UPDATE [${ORDERS_SCHEMA}].[Utilizador] SET Pwd=@hash, DT_Changed_Psw=GETUTCDATE(), Fail_Login=0${firstLogin ? ', NewUser=0' : ''} WHERE ID_User=@id`)
}

export async function markAuthSuccess(pool: ConnectionPool, id: string): Promise<void> {
  const request = pool.request(); request.input('id', mssql.NVarChar(30), id)
  await request.query(`UPDATE [${ORDERS_SCHEMA}].[Utilizador] SET Fail_Login=0, DT_Last_Login=GETUTCDATE() WHERE ID_User=@id`)
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
         (ID_User, User_Name, Read_Only, Admin, DT_Criacao, Cancelado, Obs, Fail_Login, NewUser)
       OUTPUT INSERTED.ID_User
       VALUES (@id, @name, @readOnly, @admin, GETUTCDATE(), 0, @obs, 0, 1)`,
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

export {
  LOCKED_CARACTERIZACAO_FIELDS,
  isHistoricoRow,
  isLockedCaracterizacaoField,
  isWarrantyStartLocked,
  startOfCurrentMonthUTC,
} from './repositories/orders/order-caracterizacao.js'
