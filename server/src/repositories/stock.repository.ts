import type { ConnectionPool } from 'mssql'
import { createRequire } from 'node:module'

const mssql = createRequire(import.meta.url)('mssql') as typeof import('mssql')

export class StockInsufficientError extends Error {
  constructor(public readonly available: number, public readonly requested: number) {
    super(`Stock insuficiente. Disponível: ${available}; pedido: ${Math.abs(requested)}.`)
    this.name = 'StockInsufficientError'
  }
}

export async function fetchStock(
  pool: ConnectionPool,
  filters: { ref?: string; warehouse?: string; description?: string },
) {
  const request = pool.request()
  request.input('ref', mssql.NVarChar, filters.ref ? `%${filters.ref}%` : null)
  request.input('warehouse', mssql.NVarChar, filters.warehouse ? `%${filters.warehouse}%` : null)
  request.input(
    'description',
    mssql.NVarChar,
    filters.description ? `%${filters.description}%` : null,
  )
  const result = await request.query<Record<string, unknown>>(`
    SELECT [arm], [arm_desc], [ref], [description], [mov_qt_sum], [price], [localizacao]
    FROM [dbo].[V_stck_Group]
    WHERE (@ref IS NULL OR [ref] LIKE @ref)
      AND (@warehouse IS NULL OR [arm_desc] LIKE @warehouse)
      AND (@description IS NULL OR [description] LIKE @description)
    ORDER BY [ref], [arm]
  `)
  return {
    columns: ['arm', 'arm_desc', 'ref', 'description', 'mov_qt_sum', 'price', 'localizacao'],
    rows: result.recordset,
  }
}

export async function fetchStockMovements(pool: ConnectionPool) {
  const result = await pool.request().query<Record<string, unknown>>(`
    SELECT [id_MovStck], [ref], [description], [localizacao], [id_arm], [arm], [arm_desc],
           [mov_date], [mov_description], [mov_qt], [mov_qt_sum]
    FROM [dbo].[V_stck_Mov_Materiais]
    ORDER BY [mov_date] DESC, [id_MovStck] DESC
  `)
  return {
    columns: [
      'id_MovStck',
      'ref',
      'description',
      'localizacao',
      'id_arm',
      'arm',
      'arm_desc',
      'mov_date',
      'mov_description',
      'mov_qt',
      'mov_qt_sum',
    ],
    rows: result.recordset,
  }
}

export async function createStockMovement(
  pool: ConnectionPool,
  values: {
    ref: string
    id_arm: number
    mov_date: string
    mov_description: string | null
    mov_qt: number
  },
) {
  const request = pool.request()
  request.input('ref', mssql.NVarChar, values.ref)
  request.input('idArm', mssql.Int, values.id_arm)
  request.input('date', mssql.DateTime, new Date(values.mov_date))
  request.input('description', mssql.NVarChar, values.mov_description)
  request.input('quantity', mssql.Numeric(18, 4), values.mov_qt)
  let result
  try {
    result = await request.query<{ id: number }>(`
      IF NOT EXISTS (SELECT 1 FROM [dbo].[stck_Materiais] WHERE [ref] = @ref)
        THROW 50001, 'The selected material does not exist.', 1;
      IF NOT EXISTS (SELECT 1 FROM [dbo].[stck_Armazens] WHERE [id_arm] = @idArm)
        THROW 50002, 'The selected warehouse does not exist.', 1;
      DECLARE @available NUMERIC(38, 10) = COALESCE((
        SELECT SUM(CAST([mov_qt] AS NUMERIC(38, 10)))
        FROM [dbo].[stck_Mov_Materiais]
        WHERE [ref] = @ref AND [id_arm] = @idArm
      ), 0);
      IF @quantity < 0 AND @available + @quantity < 0
        THROW 50003, 'Insufficient stock.', 1;
      INSERT INTO [dbo].[stck_Mov_Materiais] ([ref], [id_arm], [mov_date], [mov_description], [mov_qt])
      VALUES (@ref, @idArm, @date, @description, @quantity);
      SELECT CAST(SCOPE_IDENTITY() AS INT) AS id;
    `)
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'number' in error && error.number === 50003) {
      const available = await pool.request()
        .input('ref', mssql.NVarChar, values.ref)
        .input('idArm', mssql.Int, values.id_arm)
        .query<{ available: number }>(`
          SELECT COALESCE(SUM(CAST([mov_qt] AS NUMERIC(38, 10))), 0) AS available
          FROM [dbo].[stck_Mov_Materiais]
          WHERE [ref] = @ref AND [id_arm] = @idArm
        `)
      throw new StockInsufficientError(Number(available.recordset[0]?.available ?? 0), values.mov_qt)
    }
    throw error
  }
  return result.recordset[0]?.id
}
