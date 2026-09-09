import { createRequire } from 'node:module'
import type { ConnectionPool, ISqlType } from 'mssql'
import { placeholders } from './sql-helpers.js'
import { toClientDetailRow, toClientSummaryRow } from './row-mappers.js'
import type {
  ClientCreateInput,
  ClientDetailRow,
  ClientSummaryRow,
  ClientUpdateChanges,
} from '../types.js'
import type { ClientListFilters } from '../types/filters.js'

const mssql = createRequire(import.meta.url)('mssql') as typeof import('mssql')

const ORDERS_SCHEMA = 'dbo'
const CLIENT_TABLE = 'Client'

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

export async function fetchClientSummaries(
  pool: ConnectionPool,
  filters: ClientListFilters,
  limit?: number,
): Promise<ClientSummaryRow[]> {
  const request = pool.request()
  const where: string[] = []

  if (filters.search) {
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

  if (limit != null) request.input('limit', mssql.Int, limit)
  const sql = `SELECT ${limit != null ? 'TOP (@limit)' : ''}
    ID_Cliente, no_PHC, ID_Tp_Cliente, nome, ncont, telefone, local
  FROM [${ORDERS_SCHEMA}].[${CLIENT_TABLE}]
  ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
  ORDER BY nome ASC, ID_Cliente ASC`

  const result = await request.query<Record<string, unknown>>(sql)
  return Array.from(result.recordset).map(toClientSummaryRow)
}

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
    request.input(
      column,
      column === 'no_PHC' || column === 'ID_Tp_Cliente' ? mssql.Int : mssql.NVarChar,
      value,
    )
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
    return fetchClientById(pool, id)
  }

  const sql = `UPDATE [${ORDERS_SCHEMA}].[${CLIENT_TABLE}]
    SET ${setClauses.join(', ')}
    WHERE ID_Cliente = @id`

  const result = await request.query(sql)
  if (result.rowsAffected[0] === 0) return null
  return fetchClientById(pool, id)
}
