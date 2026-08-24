import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'
import type { ConnectionPool } from 'mssql'
import {
  buildSqlConfig,
  fetchOrderById,
  fetchOrderSummaries,
  fetchRows,
  isHistoricoRow,
  isLockedCaracterizacaoField,
  listTables,
  updateOrder,
} from './db.js'

// mssql is CommonJS; load it the same way db.ts does so the type constants (Int, NVarChar,
// Bit) match the runtime values the production code binds.
const mssql = createRequire(import.meta.url)('mssql') as typeof import('mssql')

type QueryResult = {
  recordset: Record<string, unknown>[] & { columns?: Record<string, unknown> }
}

function poolReturning(...results: QueryResult[]): ConnectionPool {
  const query = vi.fn()
  for (const result of results) query.mockResolvedValueOnce(result)

  return {
    request: vi.fn(() => ({
      input: vi.fn().mockReturnThis(),
      query,
    })),
  } as unknown as ConnectionPool
}

// Captures every bound input and the final SQL string so orders tests can assert the
// generated WHERE clause and parameter types without a real database.
type CapturedInput = { name: string; type: unknown; value: unknown }
type CapturedRequest = { inputs: CapturedInput[]; sql: string }
function capturingPool(recordset: Record<string, unknown>[]): {
  pool: ConnectionPool
  captured: CapturedRequest
} {
  const captured: CapturedRequest = { inputs: [], sql: '' }
  const requestObj = {
    input: vi.fn((name: string, type: unknown, value: unknown) => {
      captured.inputs.push({ name, type, value })
      return requestObj
    }),
    query: vi.fn(async (sql: string) => {
      captured.sql = sql
      return { recordset }
    }),
  }
  const pool = { request: vi.fn(() => requestObj) } as unknown as ConnectionPool
  return { pool, captured }
}

describe('Orders list query', () => {
  it('builds a parameterized WHERE for every supplied filter and orders newest-first', async () => {
    const { pool, captured } = capturingPool([
      {
        ID_Order: 1,
        DT_Order: '2026-08-23T00:00:00Z',
        Order_Factory: 1,
        ID_Tp_Order: 'C',
        ID_Client: 93,
        Client_Name: 'ITQB Noval',
        ID_Area: 'BDAL',
        ID_Tipo: 'INSTR',
        ID_Produto: 2,
        ID_Instrumento: 1,
        Sell_Price: 12500,
        Negocio_Fechado: 1,
        Encomenda_Cli_PHC: 'PHC-001',
        Provisoria: 1,
      },
    ])

    await fetchOrderSummaries(pool, {
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      clientName: 'ITQB',
      orderFactory: true,
      negocioFechado: true,
      idTpOrder: ['C'],
      idArea: ['BDAL'],
      idTipo: ['INSTR'],
      idProduto: [2],
      idInstrumento: [1],
      encomendaCliPHC: 'PHC',
    }, 200)

    // Half-open upper bound: dateTo uses DATEADD, never <=.
    expect(captured.sql).toContain('DT_Order >= @dateFrom')
    expect(captured.sql).toContain('DT_Order < DATEADD(day, 1, @dateTo)')
    expect(captured.sql).toContain('nome LIKE @clientName')
    expect(captured.sql).toContain('Order_Factory = @orderFactory')
    expect(captured.sql).toContain('Negocio_Fechado = @negocioFechado')
    // Categorical multi-select filters expand to parameterized IN (@p0, …) clauses.
    expect(captured.sql).toContain('ID_Tp_Order IN (@idTpOrder0)')
    expect(captured.sql).toContain('ID_Area IN (@idArea0)')
    expect(captured.sql).toContain('ID_Tipo IN (@idTipo0)')
    expect(captured.sql).toContain('ID_Produto IN (@idProduto0)')
    expect(captured.sql).toContain('ID_Instrumento IN (@idInstrumento0)')
    expect(captured.sql).toContain('Encomenda_Cli_PHC LIKE @encomendaCliPHC')
    expect(captured.sql).toContain('ORDER BY DT_Order DESC, ID_Order DESC')
    expect(captured.sql).toContain('FROM [dbo].[V_Order_List]')
    // Provisoria bit column is projected from the view and coerced to a boolean.
    expect(captured.sql).toContain('Provisoria')

    const input = (name: string) => captured.inputs.find((entry) => entry.name === name)
    expect(input('dateFrom')).toEqual({ name: 'dateFrom', type: mssql.NVarChar, value: '2026-01-01' })
    expect(input('dateTo')).toEqual({ name: 'dateTo', type: mssql.NVarChar, value: '2026-01-31' })
    expect(input('clientName')).toEqual({
      name: 'clientName',
      type: mssql.NVarChar,
      value: '%ITQB%',
    })
    expect(input('orderFactory')).toEqual({
      name: 'orderFactory',
      type: mssql.Bit,
      value: true,
    })
    expect(input('negocioFechado')).toEqual({
      name: 'negocioFechado',
      type: mssql.Bit,
      value: true,
    })
    expect(input('idArea0')).toEqual({ name: 'idArea0', type: mssql.NVarChar, value: 'BDAL' })
    expect(input('idProduto0')).toEqual({ name: 'idProduto0', type: mssql.Int, value: 2 })
    expect(input('idInstrumento0')).toEqual({
      name: 'idInstrumento0',
      type: mssql.Int,
      value: 1,
    })
    expect(input('limit')).toEqual({ name: 'limit', type: mssql.Int, value: 200 })
  })

  it('omits the WHERE clause when no filters are supplied', async () => {
    const { pool, captured } = capturingPool([])
    await fetchOrderSummaries(pool, {}, 10)
    expect(captured.sql).not.toContain('WHERE')
    expect(captured.sql).toContain('ORDER BY DT_Order DESC, ID_Order DESC')
  })

  it('coerces numeric bit columns to booleans and leaves nulls null', async () => {
    const { pool } = capturingPool([
      {
        ID_Order: 2,
        DT_Order: null,
        Order_Factory: 0,
        ID_Tp_Order: null,
        ID_Client: null,
        Client_Name: null,
        ID_Area: null,
        ID_Tipo: null,
        ID_Produto: null,
        ID_Instrumento: null,
        Sell_Price: null,
        Negocio_Fechado: null,
        Encomenda_Cli_PHC: null,
        Provisoria: 0,
      },
    ])

    const rows = await fetchOrderSummaries(pool, {}, 10)
    expect(rows).toHaveLength(1)
    expect(rows[0].Order_Factory).toBe(false)
    expect(rows[0].Negocio_Fechado).toBeNull()
    // Provisoria is a bit column coerced the same way as Order_Factory.
    expect(rows[0].Provisoria).toBe(false)
    // DT_Order is non-null in the contract; a stray null coerces to '' (defensive).
    expect(rows[0].DT_Order).toBe('')
    expect(rows[0].ID_Order).toBe(2)
  })

  it('serializes datetime columns from JS Date objects to ISO 8601 UTC', async () => {
    const { pool } = capturingPool([
      {
        ID_Order: 3,
        // mssql returns datetime columns as JS Date objects, not strings.
        DT_Order: new Date('2022-10-26T00:00:00.000Z'),
        Order_Factory: false,
        ID_Tp_Order: 'C',
        ID_Client: 1,
        Client_Name: 'Acme',
        ID_Area: 'BDAL',
        ID_Tipo: 'INSTR',
        ID_Produto: 1,
        ID_Instrumento: 1,
        Sell_Price: 100,
        Negocio_Fechado: false,
        Encomenda_Cli_PHC: 'X',
      },
    ])

    const rows = await fetchOrderSummaries(pool, {}, 10)
    // ISO on the wire, never a Date.toString() locale dump (TIMEZONE.md).
    expect(rows[0].DT_Order).toBe('2022-10-26T00:00:00.000Z')
  })
})

describe('Order detail query', () => {
  it('joins Client for the name and contact, binds the id, and drops upsize_ts', async () => {
    const { pool, captured } = capturingPool([
      {
        ID_Order: 1,
        DT_Order: '2026-08-23T00:00:00Z',
        Order_Factory: true,
        ID_Tp_Order: 'C',
        ID_Client: 93,
        Client_Name: 'ITQB Noval',
        ID_Area: 'BDAL',
        ID_Tipo: 'INSTR',
        ID_Produto: 2,
        ID_Instrumento: 1,
        Orc_Proposta: 12000,
        PO_Cliente: 'PO-1',
        Sell_Price: 12500,
        ID_Tp_Warranty: 2,
        Warranty_Reserve: 500,
        Warranty_DT_Inicio: '2026-01-01T00:00:00Z',
        ID_Tp_Revenue: 1,
        Facturado: false,
        Reconhecido: false,
        Cod_Enc_Fornecedor: 'SUP-1',
        Obs: 'Approved',
        Negocio_Fechado: true,
        ID_User: 'arocha',
        DT_User: '2026-08-23T00:00:00Z',
        Kit: false,
        Kit_Amount: null,
        Contacto: 'João',
        Provisoria: 1,
      },
    ])

    const order = await fetchOrderById(pool, 1)

    expect(captured.sql).toContain('FROM [dbo].[Order] AS o')
    expect(captured.sql).toContain('LEFT JOIN [dbo].[Client] AS c ON o.ID_Client = c.ID_Cliente')
    // Provisoria is resolved via a LEFT JOIN to V_Order_List (keyed by ID_Order).
    expect(captured.sql).toContain('LEFT JOIN [dbo].[V_Order_List] AS v ON v.ID_Order = o.ID_Order')
    expect(captured.sql).toContain('v.Provisoria AS Provisoria')
    expect(captured.sql).toContain('WHERE o.ID_Order = @id')
    expect(captured.inputs[0]).toEqual({ name: 'id', type: mssql.Int, value: 1 })
    expect(order).not.toBeNull()
    expect(order?.Client_Name).toBe('ITQB Noval')
    expect(order?.Contacto).toBe('João')
    expect(order?.ID_Tp_Warranty).toBe(2)
    // Provisoria bit coerced to boolean; Orc_Proposta is nvarchar, exposed as a string.
    expect(order?.Provisoria).toBe(true)
    expect(typeof order?.Orc_Proposta).toBe('string')
    expect('upsize_ts' in (order as Record<string, unknown>)).toBe(false)
  })

  it('returns null when no order matches the id', async () => {
    const { pool } = capturingPool([])
    await expect(fetchOrderById(pool, 9999999)).resolves.toBeNull()
  })

  it('serializes detail datetime columns (DT_User, Warranty_DT_Inicio) to ISO', async () => {
    const { pool } = capturingPool([
      {
        ID_Order: 1,
        DT_Order: new Date('2022-10-26T00:00:00.000Z'),
        Order_Factory: false,
        ID_Tp_Order: 'C',
        ID_Client: 93,
        Client_Name: 'ITQB Noval',
        ID_Area: 'BDAL',
        ID_Tipo: 'INSTR',
        ID_Produto: 2,
        ID_Instrumento: 1,
        Orc_Proposta: 12000,
        PO_Cliente: 'PO-1',
        Sell_Price: 12500,
        ID_Tp_Warranty: 2,
        Warranty_Reserve: 500,
        Warranty_DT_Inicio: new Date('2026-01-01T00:00:00.000Z'),
        ID_Tp_Revenue: 1,
        Facturado: false,
        Reconhecido: false,
        Cod_Enc_Fornecedor: 'SUP-1',
        Obs: 'Approved',
        Negocio_Fechado: true,
        ID_User: 'arocha',
        DT_User: new Date('2026-08-23T00:00:00.000Z'),
        Kit: false,
        Kit_Amount: null,
        Contacto: 'João',
      },
    ])

    const order = await fetchOrderById(pool, 1)
    expect(order?.DT_Order).toBe('2022-10-26T00:00:00.000Z')
    expect(order?.Warranty_DT_Inicio).toBe('2026-01-01T00:00:00.000Z')
    expect(order?.DT_User).toBe('2026-08-23T00:00:00.000Z')
  })
})

describe('Order update', () => {
  // updateOrder runs an UPDATE (rowsAffected) then re-reads via fetchOrderById. This mock
  // returns the UPDATE result first, then the re-read recordset. The UPDATE SQL is the
  // first query call; the SELECT re-read is the second — capture the first only so it is
  // not overwritten by the SELECT.
  type UpdateResult = { rowsAffected: number[]; recordset: Record<string, unknown>[] }
  function updatePool(
    rowsAffected: number,
    reread: Record<string, unknown>[],
  ): { pool: ConnectionPool; captured: CapturedRequest } {
    const captured: CapturedRequest = { inputs: [], sql: '' }
    const requestObj = {
      input: vi.fn((name: string, type: unknown, value: unknown) => {
        captured.inputs.push({ name, type, value })
        return requestObj
      }),
      query: vi.fn(async (sql: string) => {
        if (captured.sql === '') captured.sql = sql
        const result: UpdateResult = { rowsAffected: [rowsAffected], recordset: reread }
        return result
      }),
    }
    const pool = { request: vi.fn(() => requestObj) } as unknown as ConnectionPool
    return { pool, captured }
  }

  const detailRecordset = [
    {
      ID_Order: 1,
      DT_Order: '2026-08-23T00:00:00Z',
      Order_Factory: true,
      ID_Tp_Order: 'C',
      ID_Client: 93,
      Client_Name: 'ITQB Noval',
      ID_Area: 'BDAL',
      ID_Tipo: 'INSTR',
      ID_Produto: 2,
      ID_Instrumento: 1,
      Orc_Proposta: 'PROP-1',
      PO_Cliente: 'PO-1',
      Sell_Price: 12500,
      ID_Tp_Warranty: 2,
      Warranty_Reserve: 500,
      Warranty_DT_Inicio: '2026-01-01T00:00:00Z',
      ID_Tp_Revenue: 1,
      Facturado: false,
      Reconhecido: false,
      Cod_Enc_Fornecedor: 'SUP-1',
      Obs: 'Approved',
      Negocio_Fechado: true,
      ID_User: 'arocha',
      DT_User: '2026-08-23T00:00:00Z',
      Kit: false,
      Kit_Amount: null,
      Contacto: 'João',
      Provisoria: 0,
    },
  ]

  it('builds a parameterized UPDATE from the whitelist and stamps ID_User/DT_User', async () => {
    const { pool, captured } = updatePool(1, detailRecordset)
    await updateOrder(pool, 1, { Obs: 'changed', Sell_Price: 9999, user: 'arocha' })

    expect(captured.sql).toContain('UPDATE [dbo].[Order]')
    // Columns appear in whitelist order (Sell_Price precedes Obs), so the SET clause is
    // `SET Sell_Price = @Sell_Price, Obs = @Obs, …` — assert each assignment, not a prefix.
    expect(captured.sql).toContain('Obs = @Obs')
    expect(captured.sql).toContain('Sell_Price = @Sell_Price')
    expect(captured.sql).toContain('ID_User = @user')
    expect(captured.sql).toContain('DT_User = GETUTCDATE()')
    expect(captured.sql).toContain('WHERE ID_Order = @id')
    // Only the columns present in the patch are bound (plus id and user).
    expect(captured.sql).not.toContain('Kit = @Kit')

    const input = (name: string) => captured.inputs.find((entry) => entry.name === name)
    expect(input('id')).toEqual({ name: 'id', type: mssql.Int, value: 1 })
    expect(input('user')).toEqual({ name: 'user', type: mssql.NVarChar, value: 'arocha' })
    expect(input('Obs')).toEqual({ name: 'Obs', type: mssql.NVarChar, value: 'changed' })
    expect(input('Sell_Price')).toEqual({ name: 'Sell_Price', type: mssql.Money, value: 9999 })
  })

  it('returns the re-read row when the UPDATE affects one row', async () => {
    const { pool } = updatePool(1, detailRecordset)
    const order = await updateOrder(pool, 1, { Obs: 'changed', user: 'arocha' })
    expect(order).not.toBeNull()
    expect(order?.ID_Order).toBe(1)
  })

  it('returns null when the UPDATE affects zero rows (id not found)', async () => {
    const { pool } = updatePool(0, detailRecordset)
    await expect(updateOrder(pool, 999, { Obs: 'changed', user: 'arocha' })).resolves.toBeNull()
  })
})

describe('Caracterização lock policy', () => {
  const today = new Date('2026-08-24T00:00:00Z')

  it('treats a past-month, non-provisional order as histórico', () => {
    const row = {
      ID_Order: 1,
      DT_Order: '2026-07-15T00:00:00Z',
      Provisoria: false,
    } as import('./types.js').OrderDetailRow
    expect(isHistoricoRow(row, today)).toBe(true)
  })

  it('does not treat a current-month order as histórico', () => {
    const row = {
      ID_Order: 1,
      DT_Order: '2026-08-15T00:00:00Z',
      Provisoria: false,
    } as import('./types.js').OrderDetailRow
    expect(isHistoricoRow(row, today)).toBe(false)
  })

  it('never treats a provisional order as histórico, even on a past month', () => {
    const row = {
      ID_Order: 1,
      DT_Order: '2026-07-15T00:00:00Z',
      Provisoria: true,
    } as import('./types.js').OrderDetailRow
    expect(isHistoricoRow(row, today)).toBe(false)
  })

  it('identifies the locked Caracterização fields', () => {
    expect(isLockedCaracterizacaoField('Sell_Price')).toBe(true)
    expect(isLockedCaracterizacaoField('DT_Order')).toBe(true)
    expect(isLockedCaracterizacaoField('ID_Tp_Revenue')).toBe(false)
    // Non-locked fields are editable even on a histórico order.
    expect(isLockedCaracterizacaoField('Obs')).toBe(false)
    expect(isLockedCaracterizacaoField('Negocio_Fechado')).toBe(false)
    expect(isLockedCaracterizacaoField('Kit')).toBe(false)
  })
})

describe('SQL Server metadata and row reads', () => {
  it('validates SQL Server certificates by default', () => {
    const config = buildSqlConfig({
      server: 'sql-orders.internal',
      port: 1433,
      database: 'Orders',
      user: 'orders_app',
      password: 'secret',
    })

    expect(config.options).toMatchObject({
      encrypt: true,
      trustServerCertificate: false,
    })
  })

  it('maps INFORMATION_SCHEMA rows to stable table metadata', async () => {
    const pool = poolReturning({
      recordset: [
        { TABLE_SCHEMA: 'dbo', TABLE_NAME: 'Orders', TABLE_TYPE: 'BASE TABLE' },
        { TABLE_SCHEMA: 'reporting', TABLE_NAME: 'V_Order_List', TABLE_TYPE: 'VIEW' },
      ],
    })

    await expect(listTables(pool)).resolves.toEqual([
      { schema: 'dbo', name: 'Orders', type: 'BASE TABLE' },
      { schema: 'reporting', name: 'V_Order_List', type: 'VIEW' },
    ])
  })

  it('only queries a table confirmed by INFORMATION_SCHEMA and binds the row limit', async () => {
    const tableResult: QueryResult = {
      recordset: [{ TABLE_SCHEMA: 'dbo', TABLE_NAME: 'Orders', TABLE_TYPE: 'BASE TABLE' }],
    }
    const rows = [{ ID_Order: 101, Client_Name: 'Acme' }]
    const recordset = Object.assign([...rows], { columns: { ID_Order: {}, Client_Name: {} } })
    const rowResult: QueryResult = { recordset }
    const pool = poolReturning(tableResult, rowResult)

    await expect(fetchRows(pool, 'dbo', 'Orders', 200)).resolves.toEqual({
      columns: ['ID_Order', 'Client_Name'],
      rows,
    })

    const secondRequest = vi.mocked(pool.request).mock.results[1].value as {
      input: ReturnType<typeof vi.fn>
      query: ReturnType<typeof vi.fn>
    }
    expect(secondRequest.input).toHaveBeenCalledWith('limit', expect.anything(), 200)
    expect(secondRequest.query).toHaveBeenCalledWith('SELECT TOP (@limit) * FROM [dbo].[Orders]')
  })

  it('rejects malicious and non-whitelisted identifiers before querying rows', async () => {
    const pool = poolReturning({
      recordset: [{ TABLE_SCHEMA: 'dbo', TABLE_NAME: 'Orders', TABLE_TYPE: 'BASE TABLE' }],
    })

    await expect(fetchRows(pool, 'dbo', 'Orders; DROP TABLE Users', 200)).rejects.toThrow(
      'not available',
    )
    expect(pool.request).toHaveBeenCalledTimes(1)
  })

  it('falls back to row keys when the driver does not expose column metadata', async () => {
    const pool = poolReturning(
      { recordset: [{ TABLE_SCHEMA: 'dbo', TABLE_NAME: 'Orders', TABLE_TYPE: 'BASE TABLE' }] },
      { recordset: [{ ID_Order: 101, DT_Order: '2026-08-23' }] },
    )

    await expect(fetchRows(pool, 'dbo', 'Orders', 10)).resolves.toEqual({
      columns: ['ID_Order', 'DT_Order'],
      rows: [{ ID_Order: 101, DT_Order: '2026-08-23' }],
    })
  })
})
