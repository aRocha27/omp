import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'
import type { ConnectionPool } from 'mssql'
import {
  buildSqlConfig,
  addFacturacao,
  addReconhecimento,
  deleteFacturacao,
  deleteReconhecimento,
  fetchFacturacaoTypes,
  fetchOrderById,
  fetchOrderSummaries,
  fetchRows,
  isHistoricoRow,
  isLockedCaracterizacaoField,
  listTables,
  propagateReconhecimento,
  RecognitionCapacityError,
  FacturacaoCapacityError,
  updateFacturacao,
  updateOrder,
  updateReconhecimento,
} from './db.js'

// mssql is CommonJS; load it the same way db.ts does so the type constants (Int, NVarChar,
// Bit) match the runtime values the production code binds.
const mssql = createRequire(import.meta.url)('mssql') as typeof import('mssql')

type QueryResult = {
  recordset: Record<string, unknown>[] & { columns?: Record<string, unknown> }
  rowsAffected?: number[]
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

type TransactionResult = {
  recordset?: Record<string, unknown>[]
  rowsAffected?: number[]
}

type CapturedTransactionRequest = {
  inputs: CapturedInput[]
  sql: string
}

function transactionPool(...results: TransactionResult[]): {
  pool: ConnectionPool
  captured: CapturedTransactionRequest[]
  begin: ReturnType<typeof vi.fn>
  commit: ReturnType<typeof vi.fn>
  rollback: ReturnType<typeof vi.fn>
} {
  const queue = [...results]
  const captured: CapturedTransactionRequest[] = []
  const begin = vi.fn().mockResolvedValue(undefined)
  const commit = vi.fn().mockResolvedValue(undefined)
  const rollback = vi.fn().mockResolvedValue(undefined)
  const transaction = {
    begin,
    commit,
    rollback,
    request: vi.fn(() => {
      const current: CapturedTransactionRequest = { inputs: [], sql: '' }
      captured.push(current)
      const request = {
        input: vi.fn((name: string, type: unknown, value: unknown) => {
          current.inputs.push({ name, type, value })
          return request
        }),
        query: vi.fn(async (sql: string) => {
          current.sql = sql
          const result = queue.shift()
          if (!result) throw new Error('Missing transaction test result.')
          return {
            recordset: result.recordset ?? [],
            rowsAffected: result.rowsAffected ?? [],
          }
        }),
      }
      return request
    }),
  }
  const pool = {
    transaction: vi.fn(() => transaction),
    request: vi.fn(() => ({
      input: vi.fn().mockReturnThis(),
      query: vi.fn().mockResolvedValue({ recordset: [] }),
    })),
  } as unknown as ConnectionPool
  return { pool, captured, begin, commit, rollback }
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
        Tipo_Warranty: 1,
        ID_Produto: 2,
        ID_Instrumento: 1,
        Sell_Price: 12500,
        Negocio_Fechado: 1,
        Encomenda_Cli_PHC: 'PHC-001',
        Provisoria: 1,
      },
    ])

    await fetchOrderSummaries(
      pool,
      {
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
      },
      200,
    )

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
    expect(input('dateFrom')).toEqual({
      name: 'dateFrom',
      type: mssql.NVarChar,
      value: '2026-01-01',
    })
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
        Tipo_Warranty: 1,
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
    expect(captured.sql).toContain('LEFT JOIN [dbo].[Tipo] AS t ON o.ID_Tipo = t.ID_Tipo')
    expect(captured.sql).toContain('t.Warranty AS Tipo_Warranty')
    // Provisoria is resolved via a LEFT JOIN to V_Order_List (keyed by ID_Order).
    expect(captured.sql).toContain('LEFT JOIN [dbo].[V_Order_List] AS v ON v.ID_Order = o.ID_Order')
    expect(captured.sql).toContain('v.Provisoria AS Provisoria')
    expect(captured.sql).toContain('WHERE o.ID_Order = @id')
    expect(captured.inputs[0]).toEqual({ name: 'id', type: mssql.Int, value: 1 })
    expect(order).not.toBeNull()
    expect(order?.Client_Name).toBe('ITQB Noval')
    expect(order?.Contacto).toBe('João')
    expect(order?.ID_Tp_Warranty).toBe(2)
    expect(order?.Tipo_Warranty).toBe(true)
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
        Tipo_Warranty: 1,
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
    const { pool, captured } = transactionPool(
      { rowsAffected: [1] },
      {
        recordset: [
          {
            Sell_Price: 9_999,
            Warranty_Reserve: 500,
            Tipo_Warranty: true,
          },
        ],
      },
      { recordset: [] },
      { recordset: [] },
    )
    await updateOrder(pool, 1, { Obs: 'changed', Sell_Price: 9999, user: 'arocha' })

    const updateRequest = captured[0]
    expect(updateRequest?.sql).toContain('UPDATE [dbo].[Order]')
    // Columns appear in whitelist order (Sell_Price precedes Obs), so the SET clause is
    // `SET Sell_Price = @Sell_Price, Obs = @Obs, …` — assert each assignment, not a prefix.
    expect(updateRequest?.sql).toContain('Obs = @Obs')
    expect(updateRequest?.sql).toContain('Sell_Price = @Sell_Price')
    expect(updateRequest?.sql).toContain('ID_User = @user')
    expect(updateRequest?.sql).toContain('DT_User = GETUTCDATE()')
    expect(updateRequest?.sql).toContain('WHERE ID_Order = @id')
    // Only the columns present in the patch are bound (plus id and user).
    expect(updateRequest?.sql).not.toContain('Kit = @Kit')

    const input = (name: string) => updateRequest?.inputs.find((entry) => entry.name === name)
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

  it('rolls back when Sell Price is reduced below the existing recognized total', async () => {
    const { pool, commit, rollback } = transactionPool(
      { rowsAffected: [1] },
      {
        recordset: [
          {
            Sell_Price: 100_000,
            Warranty_Reserve: 6_600,
            Tipo_Warranty: true,
          },
        ],
      },
      {
        recordset: [
          { ID_Tp_Reconhecimento: 'T', Valor_Reconhecimento: 125_400 },
          { ID_Tp_Reconhecimento: 'WP', Valor_Reconhecimento: 6_600 },
        ],
      },
    )

    await expect(
      updateOrder(pool, 1, { Sell_Price: 100_000, user: 'arocha' }),
    ).rejects.toThrow(RecognitionCapacityError)
    expect(commit).not.toHaveBeenCalled()
    expect(rollback).toHaveBeenCalledOnce()
  })

  it('rolls back when Sell Price is reduced below the existing net invoiced total', async () => {
    const { pool, commit, rollback } = transactionPool(
      { rowsAffected: [1] },
      {
        recordset: [
          {
            Sell_Price: 120_000,
            Warranty_Reserve: 6_600,
            Tipo_Warranty: true,
          },
        ],
      },
      { recordset: [] },
      { recordset: [{ Valor_Doc_FT: 129_000 }] },
    )

    await expect(
      updateOrder(pool, 1, { Sell_Price: 120_000, user: 'arocha' }),
    ).rejects.toThrow(FacturacaoCapacityError)
    expect(commit).not.toHaveBeenCalled()
    expect(rollback).toHaveBeenCalledOnce()
  })

  it('rolls back when Warranty Reserve is reduced below existing W/WP recognition', async () => {
    const { pool, commit, rollback } = transactionPool(
      { rowsAffected: [1] },
      {
        recordset: [
          {
            Sell_Price: 132_000,
            Warranty_Reserve: 5_000,
            Tipo_Warranty: true,
          },
        ],
      },
      { recordset: [{ ID_Tp_Reconhecimento: 'WP', Valor_Reconhecimento: 6_600 }] },
    )

    await expect(
      updateOrder(pool, 1, { Warranty_Reserve: 5_000, user: 'arocha' }),
    ).rejects.toThrow(RecognitionCapacityError)
    expect(commit).not.toHaveBeenCalled()
    expect(rollback).toHaveBeenCalledOnce()
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

describe('Recognition mutations', () => {
  const current = {
    ID_Reconhecimento: 7,
    ID_Order: 101,
    ID_Tp_Reconhecimento: 'P',
    DT_Reconhecimento: '2026-08-01T00:00:00Z',
    Valor_Reconhecimento: 50,
    ID_User: 'old-user',
    DT_User: '2026-08-01T00:00:00Z',
  }

  it('adds a row atomically and accepts the exact total and instrument limits', async () => {
    const inserted = { ...current, Valor_Reconhecimento: 200, ID_User: 'editor' }
    const { pool, captured, commit } = transactionPool(
      { recordset: [{ Sell_Price: 1000, Warranty_Reserve: 100, Tipo_Warranty: true }] },
      {
        recordset: [
          { ID_Tp_Reconhecimento: 'P', Valor_Reconhecimento: 700 },
          { ID_Tp_Reconhecimento: 'WP', Valor_Reconhecimento: 100 },
        ],
      },
      { recordset: [inserted], rowsAffected: [1] },
    )

    await expect(
      addReconhecimento(
        pool,
        {
          ID_Order: 101,
          ID_Tp_Reconhecimento: 'P',
          DT_Reconhecimento: '2026-09-01',
          Valor_Reconhecimento: 200,
        },
        'editor',
      ),
    ).resolves.toMatchObject({ ID_Reconhecimento: 7, Valor_Reconhecimento: 200 })
    expect(captured[0]?.sql).toContain('UPDLOCK, HOLDLOCK')
    expect(captured[2]?.sql).toContain('OUTPUT INSERTED.ID_Reconhecimento')
    expect(commit).toHaveBeenCalledOnce()
  })

  it('updates a row atomically, excludes its old value, and accepts the exact bucket limit', async () => {
    const updated = { ...current, Valor_Reconhecimento: 200, ID_User: 'editor' }
    const { pool, captured, commit, rollback } = transactionPool(
      { recordset: [{ ID_Order: 101 }] },
      { recordset: [{ Sell_Price: 1000, Warranty_Reserve: 100, Tipo_Warranty: true }] },
      { recordset: [current] },
      {
        recordset: [
          { ID_Tp_Reconhecimento: 'P', Valor_Reconhecimento: 700 },
          { ID_Tp_Reconhecimento: 'WP', Valor_Reconhecimento: 100 },
        ],
      },
      { recordset: [updated], rowsAffected: [1] },
    )

    await expect(
      updateReconhecimento(pool, 7, { Valor_Reconhecimento: 200 }, 'editor'),
    ).resolves.toMatchObject({ ID_Reconhecimento: 7, Valor_Reconhecimento: 200 })

    expect(commit).toHaveBeenCalledOnce()
    expect(rollback).not.toHaveBeenCalled()
    expect(captured.some((entry) => entry.sql.includes('UPDLOCK, HOLDLOCK'))).toBe(true)
    expect(captured.at(-1)?.sql).toContain('UPDATE [dbo].[Reconhecimento]')
    expect(captured.at(-1)?.sql).toContain('OUTPUT INSERTED.ID_Reconhecimento')
  })

  it('rolls back when an edit would exceed the instrument bucket', async () => {
    const { pool, captured, commit, rollback } = transactionPool(
      { recordset: [{ ID_Order: 101 }] },
      { recordset: [{ Sell_Price: 1000, Warranty_Reserve: 100, Tipo_Warranty: true }] },
      { recordset: [current] },
      {
        recordset: [
          { ID_Tp_Reconhecimento: 'P', Valor_Reconhecimento: 850 },
          { ID_Tp_Reconhecimento: 'WP', Valor_Reconhecimento: 100 },
        ],
      },
    )

    await expect(
      updateReconhecimento(pool, 7, { Valor_Reconhecimento: 100 }, 'editor'),
    ).rejects.toBeInstanceOf(RecognitionCapacityError)
    expect(commit).not.toHaveBeenCalled()
    expect(rollback).toHaveBeenCalledOnce()
    expect(captured.every((entry) => !entry.sql.includes('UPDATE [dbo].[Reconhecimento]'))).toBe(
      true,
    )
  })

  it('hard-deletes by primary key and reports whether a row existed', async () => {
    const found = poolReturning({ recordset: [], rowsAffected: [1] })
    const missing = poolReturning({ recordset: [], rowsAffected: [0] })

    await expect(deleteReconhecimento(found, 7)).resolves.toBe(true)
    await expect(deleteReconhecimento(missing, 999)).resolves.toBe(false)
  })

  it('propagates a two-year warranty into 12 monthly WP rows from start + 12 months', async () => {
    const inserted = Array.from({ length: 12 }, (_, index) => ({
      ...current,
      ID_Reconhecimento: 100 + index,
      ID_Tp_Reconhecimento: 'WP',
      DT_Reconhecimento: new Date(Date.UTC(2026, 4 + index, 1)),
      Valor_Reconhecimento: 10,
    }))
    const { pool, captured, commit } = transactionPool(
      {
        recordset: [
          {
            ID_Order: 101,
            ID_Tipo: 'INSTR',
            Tipo_Warranty: 1,
            Sell_Price: 1000,
            Warranty_Reserve: 120,
            Warranty_DT_Inicio: new Date('2025-05-08T00:00:00Z'),
            N_Anos: 2,
          },
        ],
      },
      { recordset: [] },
      { recordset: inserted, rowsAffected: [12] },
    )

    const rows = await propagateReconhecimento(pool, { orderId: 101, kind: 'warranty' }, 'editor')

    expect(rows).toHaveLength(12)
    expect(rows[0]).toMatchObject({
      ID_Tp_Reconhecimento: 'WP',
      DT_Reconhecimento: '2026-05-01T00:00:00.000Z',
      Valor_Reconhecimento: 10,
    })
    expect(rows[11]?.DT_Reconhecimento).toBe('2027-04-01T00:00:00.000Z')
    expect(captured[0]?.sql).toContain('LEFT JOIN [dbo].[Tipo]')
    expect(captured[0]?.sql).toContain('LEFT JOIN [dbo].[Tp_Warranty]')
    expect(captured[2]?.sql).toContain('INSERT INTO [dbo].[Reconhecimento]')
    expect(commit).toHaveBeenCalledOnce()
  })

  it('binds propagated values at SQL money four-decimal precision', async () => {
    const inserted = Array.from({ length: 12 }, (_, index) => ({
      ...current,
      ID_Reconhecimento: 300 + index,
      ID_Tp_Reconhecimento: 'WP',
      DT_Reconhecimento: new Date(Date.UTC(2026, index, 1)),
      Valor_Reconhecimento: 0,
    }))
    const { pool, captured } = transactionPool(
      {
        recordset: [{
          ID_Order: 101,
          ID_Tipo: 'INSTR',
          Tipo_Warranty: 1,
          Sell_Price: 100.0001,
          Warranty_Reserve: 100.0001,
          Warranty_DT_Inicio: new Date('2025-01-08T00:00:00Z'),
          N_Anos: 2,
        }],
      },
      { recordset: [] },
      { recordset: inserted, rowsAffected: [12] },
    )

    await propagateReconhecimento(pool, { orderId: 101, kind: 'warranty' }, 'editor')

    const values = captured[2]?.inputs
      .filter((input) => input.name.startsWith('value'))
      .map((input) => input.value)
    expect(values).toEqual([
      8.3334, 8.3334, 8.3334, 8.3334, 8.3334,
      8.3333, 8.3333, 8.3333, 8.3333, 8.3333, 8.3333, 8.3333,
    ])
  })

  it('rolls back propagation before insert when existing rows consume the bucket', async () => {
    const { pool, captured, commit, rollback } = transactionPool(
      {
        recordset: [
          {
            ID_Order: 101,
            ID_Tipo: 'INSTR',
            Tipo_Warranty: 1,
            Sell_Price: 1000,
            Warranty_Reserve: 120,
            Warranty_DT_Inicio: new Date('2025-05-08T00:00:00Z'),
            N_Anos: 2,
          },
        ],
      },
      { recordset: [{ ID_Tp_Reconhecimento: 'W', Valor_Reconhecimento: 1 }] },
    )

    await expect(
      propagateReconhecimento(pool, { orderId: 101, kind: 'warranty' }, 'editor'),
    ).rejects.toBeInstanceOf(RecognitionCapacityError)
    expect(commit).not.toHaveBeenCalled()
    expect(rollback).toHaveBeenCalledOnce()
    expect(captured).toHaveLength(2)
  })

  it('generates maintenance rows from the selected contract start and duration', async () => {
    const inserted = Array.from({ length: 24 }, (_, index) => ({
      ...current,
      ID_Reconhecimento: 200 + index,
      ID_Tp_Reconhecimento: 'CM',
      DT_Reconhecimento: new Date(Date.UTC(2027, 1 + index, 1)),
      Valor_Reconhecimento: 50,
    }))
    const { pool } = transactionPool(
      {
        recordset: [
          {
            ID_Order: 101,
            ID_Tipo: 'CM',
            Tipo_Warranty: 0,
            Sell_Price: 1200,
            Warranty_Reserve: null,
            Warranty_DT_Inicio: null,
            N_Anos: null,
          },
        ],
      },
      { recordset: [] },
      { recordset: inserted, rowsAffected: [24] },
    )

    const rows = await propagateReconhecimento(
      pool,
      { orderId: 101, kind: 'maintenance', startDate: '2027-02-18', years: 2 },
      'editor',
    )
    expect(rows).toHaveLength(24)
    expect(rows[0]).toMatchObject({
      ID_Tp_Reconhecimento: 'CM',
      DT_Reconhecimento: '2027-02-01T00:00:00.000Z',
      Valor_Reconhecimento: 50,
    })
  })
})

describe('Invoicing mutations', () => {
  const current = {
    ID_Facturacao: 3,
    ID_Order: 101,
    DT_Doc_FT: '2026-08-01T00:00:00Z',
    ID_Tp_Doc_FT: 'FT',
    N_Doc_FT: 'FT 1',
    Valor_Doc_FT: 500,
    ID_User: 'old-user',
    DT_User: '2026-08-01T00:00:00Z',
  }

  it('reads document types and descriptive labels directly from dbo.Tp_Doc_FT', async () => {
    const { pool, captured } = capturingPool([
      { ID_Tp_Doc_FT: 'AcFT', Tp_Doc_FT: 'Acerto Factura' },
      { ID_Tp_Doc_FT: 'FT', Tp_Doc_FT: 'Factura' },
      { ID_Tp_Doc_FT: 'NC', Tp_Doc_FT: 'Nota Crédito' },
    ])

    await expect(fetchFacturacaoTypes(pool)).resolves.toEqual([
      { id: 'AcFT', label: 'Acerto Factura' },
      { id: 'FT', label: 'Factura' },
      { id: 'NC', label: 'Nota Crédito' },
    ])
    expect(captured.sql).toContain('FROM [dbo].[Tp_Doc_FT]')
    expect(captured.sql).toContain('ID_Tp_Doc_FT')
    expect(captured.sql).toContain('Tp_Doc_FT')
  })

  it('rejects an added document when net invoiced would exceed Sell Price', async () => {
    const { pool, captured, commit, rollback } = transactionPool(
      { recordset: [{ Sell_Price: 1000 }] },
      { recordset: [{ Valor_Doc_FT: 900 }] },
    )

    await expect(
      addFacturacao(
        pool,
        {
          ID_Order: 101,
          DT_Doc_FT: '2026-09-01',
          ID_Tp_Doc_FT: 'FT',
          N_Doc_FT: 'FT 2',
          Valor_Doc_FT: 200,
        },
        'editor',
      ),
    ).rejects.toBeInstanceOf(FacturacaoCapacityError)
    expect(commit).not.toHaveBeenCalled()
    expect(rollback).toHaveBeenCalledOnce()
    expect(captured).toHaveLength(2)
  })

  it('updates a document at the exact net limit while excluding its old value', async () => {
    const updated = { ...current, Valor_Doc_FT: 400, ID_User: 'editor' }
    const { pool, captured, commit } = transactionPool(
      { recordset: [{ ID_Order: 101 }] },
      { recordset: [{ Sell_Price: 1000 }] },
      { recordset: [current] },
      { recordset: [{ Valor_Doc_FT: 600 }] },
      { recordset: [updated], rowsAffected: [1] },
    )

    await expect(updateFacturacao(pool, 3, { Valor_Doc_FT: 400 }, 'editor')).resolves.toMatchObject(
      { ID_Facturacao: 3, Valor_Doc_FT: 400 },
    )
    expect(captured.at(-1)?.sql).toContain('UPDATE [dbo].[Facturacao]')
    expect(commit).toHaveBeenCalledOnce()
  })

  it('hard-deletes an invoicing document by primary key', async () => {
    const pool = poolReturning({ recordset: [], rowsAffected: [1] })
    await expect(deleteFacturacao(pool, 3)).resolves.toBe(true)
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
