import { createRequire } from 'node:module'
import type { ConnectionPool } from 'mssql'
import { numberOrNull, stringOrNull } from './sql-helpers.js'
import type { AreaRow, InstrumentoRow, ProdutoRow } from '../types.js'

const mssql = createRequire(import.meta.url)('mssql') as typeof import('mssql')
const ORDERS_SCHEMA = 'dbo'

export async function fetchAreas(pool: ConnectionPool): Promise<AreaRow[]> {
  const result = await pool
    .request()
    .query<Record<string, unknown>>(
      `SELECT ID_Area, Area FROM [${ORDERS_SCHEMA}].[Area] ORDER BY ID_Area ASC`,
    )
  return result.recordset.map((row) => ({
    id: stringOrNull(row.ID_Area) ?? '',
    label: stringOrNull(row.Area) ?? '',
  }))
}

export async function fetchProdutos(pool: ConnectionPool, area?: string): Promise<ProdutoRow[]> {
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
