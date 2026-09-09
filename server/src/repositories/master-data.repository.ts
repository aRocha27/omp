import type { ConnectionPool } from 'mssql'
import { IDENTIFIER_PATTERN, TableUnavailableError, listTables } from './database.js'
import type { MasterDataResult, MasterDataValue } from '../types/master-data.js'

const MASTER_DATA_TABLES = new Set([
  'Area',
  'ChargeCategory',
  'Grp_Report',
  'Identificacao',
  'Produto',
  'ServiceType',
  'Tipo',
  'Tp_Cliente',
  'Tp_Doc_FT',
  'Tp_Order',
  'Tp_Reconhecimento',
  'Tp_Revenue',
  'Tp_Warranty',
  'Instrumento',
  'Utilizador',
  'stck_Materiais',
  'stck_Armazens',
])
const GENERATED_ID_COLUMNS: Record<string, string> = {
  // These legacy tables do not use IDENTITY columns, so their keys must be
  // supplied by the application. Identity-backed keys are omitted and let
  // SQL Server generate them during INSERT.
  ChargeCategory: 'ID',
  Grp_Report: 'ID_Grp_Report',
  ServiceType: 'ID',
}
const LOCKED_COLUMNS = new Set(['upsize_ts', 'ID_User', 'DT_User'])
const HIDDEN_COLUMNS_BY_TABLE: Record<string, ReadonlySet<string>> = {
  Utilizador: new Set(['Pwd', 'Fail_Login', 'DT_Last_Login', 'DT_Changed_Psw']),
}
const WRITE_PROTECTED_COLUMNS_BY_TABLE: Record<string, ReadonlySet<string>> = {
  Utilizador: new Set(['Pwd']),
}
const MATERIALS_LIMIT = 25000

function masterDataIdentifier(table: string): string {
  if (!IDENTIFIER_PATTERN.test(table) || !MASTER_DATA_TABLES.has(table))
    throw new TableUnavailableError()
  return `[dbo].[${table}]`
}
async function existingIdentifier(pool: ConnectionPool, table: string): Promise<string> {
  const target = masterDataIdentifier(table)
  const tables = await listTables(pool)
  if (!tables.some((item) => item.schema === 'dbo' && item.name === table))
    throw new TableUnavailableError()
  return target
}

export async function fetchMasterData(
  pool: ConnectionPool,
  table: string,
  limit = 200,
): Promise<MasterDataResult> {
  const target = await existingIdentifier(pool, table)
  const request = pool.request()
  request.input('limit', limit)
  const result = await request.query<Record<string, unknown>>(
    table === 'stck_Materiais'
      ? `SELECT * FROM ${target} ORDER BY [description] ASC, [ref] ASC`
      : `SELECT TOP (@limit) * FROM ${target}`,
  )
  const hiddenColumns = HIDDEN_COLUMNS_BY_TABLE[table]
  const rows = Array.from(result.recordset).map((row) => {
    if (!hiddenColumns) return row
    return Object.fromEntries(Object.entries(row).filter(([column]) => !hiddenColumns.has(column)))
  })
  const columns = Object.keys(rows[0] ?? result.recordset.columns ?? {}).filter(
    (column) => !hiddenColumns?.has(column),
  )
  if (table !== 'stck_Materiais')
    return { columns, rows }
  const countResult = await pool.request().query<{ totalRows: number }>(
    `SELECT COUNT_BIG(*) AS totalRows FROM ${target}`,
  )
  return {
    columns,
    rows,
    totalRows: Number(countResult.recordset[0]?.totalRows ?? rows.length),
  }
}
export async function createMasterData(
  pool: ConnectionPool,
  table: string,
  values: Record<string, MasterDataValue>,
): Promise<MasterDataResult> {
  const target = await existingIdentifier(pool, table)
  const inputValues = { ...values }
  const generatedId = GENERATED_ID_COLUMNS[table]
  if (generatedId && (inputValues[generatedId] == null || inputValues[generatedId] === '')) {
    const result = await pool
      .request()
      .query<{ nextId: number }>(
        `SELECT ISNULL(MAX([${generatedId}]), 0) + 1 AS nextId FROM ${target}`,
      )
    inputValues[generatedId] = result.recordset[0]?.nextId ?? 1
  }
  const protectedColumns = WRITE_PROTECTED_COLUMNS_BY_TABLE[table]
  const entries = Object.entries(inputValues).filter(
    ([column]) => IDENTIFIER_PATTERN.test(column) && !protectedColumns?.has(column),
  )
  if (entries.length === 0) throw new Error('At least one table value is required.')
  const request = pool.request()
  const columns = entries.map(([column]) => `[${column}]`).join(', ')
  const parameters = entries.map(([, value], index) => {
    const parameter = `value${index}`
    request.input(parameter, value)
    return `@${parameter}`
  })
  await request.query(`INSERT INTO ${target} (${columns}) VALUES (${parameters.join(', ')})`)
  return fetchMasterData(pool, table, table === 'stck_Materiais' ? MATERIALS_LIMIT : undefined)
}
export async function deleteMasterData(
  pool: ConnectionPool,
  table: string,
  key: string,
  value: string | number,
): Promise<void> {
  const target = await existingIdentifier(pool, table)
  if (!IDENTIFIER_PATTERN.test(key)) throw new Error('Invalid table key.')
  if (WRITE_PROTECTED_COLUMNS_BY_TABLE[table]?.has(key)) throw new Error('Invalid table key.')
  const request = pool.request()
  request.input('value', value)
  await request.query(`DELETE FROM ${target} WHERE [${key}] = @value`)
}
export async function updateMasterData(
  pool: ConnectionPool,
  table: string,
  key: string,
  value: string | number,
  values: Record<string, MasterDataValue>,
): Promise<MasterDataResult> {
  const target = await existingIdentifier(pool, table)
  if (!IDENTIFIER_PATTERN.test(key)) throw new Error('Invalid table key.')
  const entries = Object.entries(values).filter(
    ([column]) =>
      IDENTIFIER_PATTERN.test(column) &&
      column !== key &&
      !LOCKED_COLUMNS.has(column) &&
      !WRITE_PROTECTED_COLUMNS_BY_TABLE[table]?.has(column),
  )
  if (entries.length === 0) throw new Error('At least one editable field is required.')
  const request = pool.request()
  request.input('rowKey', value)
  const assignments = entries.map(([column, fieldValue], index) => {
    const parameter = `value${index}`
    request.input(parameter, fieldValue)
    return `[${column}] = @${parameter}`
  })
  await request.query(`UPDATE ${target} SET ${assignments.join(', ')} WHERE [${key}] = @rowKey`)
  return fetchMasterData(pool, table, table === 'stck_Materiais' ? MATERIALS_LIMIT : undefined)
}
