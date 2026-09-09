import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'
import type { ConnectionPool } from 'mssql'
import {
  buildSqlConfig,
  addFacturacao,
  addReconhecimento,
  deleteFacturacao,
  deleteReconhecimento,
  fetchDashboardSnapshot,
  fetchFacturacaoTypes,
  fetchOrderById,
  fetchOrderFacets,
  fetchOrderSummaries,
  fetchPagedOrderSummaries,
  fetchRecognitionQueue,
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
  createOrder,
  updateOrderWarrantyYears,
  ClientNotFoundError,
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
      0,
    )

    // Half-open upper bound: dateTo uses DATEADD, never <=.
    expect(captured.sql).toContain('v.DT_Order >= @dateFrom')
    expect(captured.sql).toContain('v.DT_Order < DATEADD(day, 1, @dateTo)')
    expect(captured.sql).toContain('v.nome LIKE @clientName')
    expect(captured.sql).toContain('v.Order_Factory = @orderFactory')
    expect(captured.sql).toContain('v.Negocio_Fechado = @negocioFechado')
    // Categorical multi-select filters expand to parameterized IN (@p0, …) clauses.
    expect(captured.sql).toContain('v.ID_Tp_Order IN (@idTpOrder0)')
    expect(captured.sql).toContain('v.ID_Area IN (@idArea0)')
    expect(captured.sql).toContain('v.ID_Tipo IN (@idTipo0)')
    expect(captured.sql).toContain('v.ID_Produto IN (@idProduto0)')
    expect(captured.sql).toContain('v.ID_Instrumento IN (@idInstrumento0)')
    expect(captured.sql).toContain('v.Encomenda_Cli_PHC LIKE @encomendaCliPHC')
    expect(captured.sql).toContain('ORDER BY v.DT_Order DESC, v.ID_Order DESC')
    expect(captured.sql).toContain('OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY')
    expect(captured.sql).toContain('FROM [dbo].[V_Order_List] AS v')
    // The 7 Order-table-only columns are joined from dbo.[Order] so the list grid can
    // render them without a per-row detail fetch.
    expect(captured.sql).toContain('LEFT JOIN [dbo].[Order] AS o ON o.ID_Order = v.ID_Order')
    expect(captured.sql).toContain('o.Kit, o.ID_Tp_Warranty')
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
    expect(input('offset')).toEqual({ name: 'offset', type: mssql.Int, value: 0 })
    expect(input('limit')).toEqual({ name: 'limit', type: mssql.Int, value: 200 })
  })

  it('omits the WHERE clause when no filters are supplied', async () => {
    const { pool, captured } = capturingPool([])
    await fetchOrderSummaries(pool, {}, 10, 30)
    expect(captured.sql).not.toContain('WHERE')
    expect(captured.sql).toContain('ORDER BY v.DT_Order DESC, v.ID_Order DESC')
    expect(captured.sql).toContain('OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY')
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

    const rows = await fetchOrderSummaries(pool, {}, 10, 0)
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

    const rows = await fetchOrderSummaries(pool, {}, 10, 0)
    // ISO on the wire, never a Date.toString() locale dump (TIMEZONE.md).
    expect(rows[0].DT_Order).toBe('2022-10-26T00:00:00.000Z')
  })
})

describe('Paged orders query', () => {
  const row = (id: number, date = '2026-08-23T00:00:00.000Z', total = 1) => ({
    ID_Order: id,
    DT_Order: date,
    Order_Factory: false,
    ID_Tp_Order: 'C',
    ID_Client: 1,
    Client_Name: 'Client',
    ID_Area: 'A',
    ID_Tipo: 'T',
    ID_Produto: 1,
    ID_Instrumento: 1,
    Sell_Price: 10,
    Negocio_Fechado: false,
    Encomenda_Cli_PHC: null,
    Provisoria: false,
    __total: total,
  })

  it('uses the default cursor predicate and a deterministic ID tie-break', async () => {
    const { pool, captured } = capturingPool(
      Array.from({ length: 301 }, (_, index) => row(index + 1, undefined, 301)),
    )
    const page = await fetchPagedOrderSummaries(pool, {
      filters: {},
      sort: { id: 'DT_Order', direction: 'desc' },
      limit: 300,
      cursor: Buffer.from(JSON.stringify({ date: '2026-08-24', id: 8 })).toString('base64url'),
    })

    expect(captured.sql).toContain('v.DT_Order < @cursorDate')
    expect(captured.sql).toContain('v.ID_Order < @cursorId')
    expect(captured.sql).toContain('ORDER BY v.DT_Order DESC, v.ID_Order DESC')
    expect(captured.sql).not.toContain('OFFSET @offset')
    expect(page.nextCursor).not.toBeNull()
  })

  it('uses OFFSET/FETCH fallback and appends ID_Order for duplicate sort values', async () => {
    const { pool, captured } = capturingPool([row(1)])
    await fetchPagedOrderSummaries(pool, {
      filters: {},
      sort: { id: 'Client_Name', direction: 'asc' },
      limit: 300,
      offset: 300,
    })

    expect(captured.sql).toContain('ORDER BY v.nome ASC, v.ID_Order ASC')
    expect(captured.sql).toContain('OFFSET @offset ROWS')
    expect(captured.sql).not.toContain('@cursorDate')
  })

  it('returns no next cursor at the end and preserves the filtered total', async () => {
    const { pool } = capturingPool([row(9, '2026-08-23T00:00:00.000Z', 1)])
    const page = await fetchPagedOrderSummaries(pool, {
      filters: { idArea: ['A'] },
      sort: { id: 'DT_Order', direction: 'desc' },
      limit: 300,
    })

    expect(page).toMatchObject({ total: 1, nextCursor: null })
    expect(page.items).toHaveLength(1)
  })
})

describe('Orders facets query (faceted filtering)', () => {
  // The pool returns a five-recordset page per request (one per facet); the test
  // calls `fetchOrderFacets` once and captures the SQL of the first request so
  // the assertions can inspect the WHERE the facet shares with the list query.
  function poolReturningFacets(recordsetByQuery: readonly Record<string, unknown>[][]): {
    pool: ConnectionPool
    sqls: string[]
  } {
    const sqls: string[] = []
    const queue = [...recordsetByQuery]
    const requestObj = {
      input: vi.fn().mockReturnThis(),
      query: vi.fn(async (sql: string) => {
        sqls.push(sql)
        const next = queue.shift() ?? []
        return { recordset: next }
      }),
    }
    const pool = { request: vi.fn(() => requestObj) } as unknown as ConnectionPool
    return { pool, sqls }
  }

  it('runs every facet against V_Order_List and excludes its own filter (no filters)', async () => {
    const { pool, sqls } = poolReturningFacets([
      [{ id: 'C', label: 'Client' }],
      [{ id: 'BDAL', label: 'BDAL area' }],
      [{ id: 'INSTR', label: 'Instrument' }],
      [{ id: 1, label: 'P1' }],
      [{ id: 1, label: 'I1' }],
    ])
    const facets = await fetchOrderFacets(pool, {})
    expect(sqls).toHaveLength(5)
    // Each facet is a DISTINCT against the view with no WHERE (no filters).
    for (const sql of sqls) {
      expect(sql).toContain('FROM [dbo].[V_Order_List] AS v')
      expect(sql).toContain('DISTINCT')
      expect(sql).not.toContain('WHERE')
    }
    expect(facets).toEqual({
      idTpOrder: [{ id: 'C', label: 'Client' }],
      idArea: [{ id: 'BDAL', label: 'BDAL area' }],
      idTipo: [{ id: 'INSTR', label: 'Instrument' }],
      idProduto: [{ id: 1, label: 'P1' }],
      idInstrumento: [{ id: 1, label: 'I1' }],
    })
  })

  it('applies every active filter to every facet and excludes only the own-facet one', async () => {
    const { pool, sqls } = poolReturningFacets([
      [{ id: 'C', label: 'Client' }],
      [{ id: 'BDAL', label: 'BDAL area' }],
      [{ id: 'INSTR', label: 'Instrument' }],
      [{ id: 1, label: 'P1' }],
      [{ id: 1, label: 'I1' }],
    ])
    await fetchOrderFacets(pool, {
      idArea: ['BDAL'],
      idTipo: ['INSTR'],
      idProduto: [1],
      orderFactory: true,
      dateFrom: '2026-01-01',
      dateTo: '2026-12-31',
      clientName: 'Alpha',
    })

    // idTpOrder: sees every active filter except idTpOrder itself.
    expect(sqls[0]).toContain('v.ID_Area IN (@idArea0)')
    expect(sqls[0]).toContain('v.ID_Tipo IN (@idTipo0)')
    expect(sqls[0]).toContain('v.ID_Produto IN (@idProduto0)')
    expect(sqls[0]).toContain('v.Order_Factory = @orderFactory')
    expect(sqls[0]).toContain('v.DT_Order >= @dateFrom')
    expect(sqls[0]).toContain('v.DT_Order < DATEADD(day, 1, @dateTo)')
    expect(sqls[0]).toContain('v.nome LIKE @clientName')
    expect(sqls[0]).not.toContain('ID_Tp_Order IN')

    // idArea: must NOT carry its own predicate.
    expect(sqls[1]).toContain('v.ID_Tipo IN (@idTipo0)')
    expect(sqls[1]).not.toContain('v.ID_Area IN')

    // idTipo: must NOT carry its own predicate.
    expect(sqls[2]).toContain('v.ID_Area IN (@idArea0)')
    expect(sqls[2]).not.toContain('v.ID_Tipo IN')

    // idProduto: own predicate excluded; Produto master join added for the hierarchy.
    expect(sqls[3]).toContain('v.ID_Area IN (@idArea0)')
    expect(sqls[3]).toContain('v.ID_Tipo IN (@idTipo0)')
    expect(sqls[3]).not.toContain('v.ID_Produto IN')
    expect(sqls[3]).toContain('LEFT JOIN [dbo].[Produto] AS p')

    // idInstrumento: own predicate excluded; both Produto + Instrumento master joins.
    expect(sqls[4]).toContain('v.ID_Area IN (@idArea0)')
    expect(sqls[4]).toContain('v.ID_Tipo IN (@idTipo0)')
    expect(sqls[4]).not.toContain('v.ID_Instrumento IN')
    expect(sqls[4]).toContain('LEFT JOIN [dbo].[Produto] AS p')
    expect(sqls[4]).toContain('LEFT JOIN [dbo].[Instrumento] AS i')
  })

  it('still applies non-facet filters (date range, factory, deal closed, client text) on every facet', async () => {
    const { pool, sqls } = poolReturningFacets([[], [], [], [], []])
    await fetchOrderFacets(pool, {
      dateFrom: '2026-01-01',
      dateTo: '2026-06-30',
      orderFactory: true,
      negocioFechado: true,
      encomendaCliPHC: 'PHC',
    })
    for (const sql of sqls) {
      expect(sql).toContain('v.DT_Order >= @dateFrom')
      expect(sql).toContain('v.DT_Order < DATEADD(day, 1, @dateTo)')
      expect(sql).toContain('v.Order_Factory = @orderFactory')
      expect(sql).toContain('v.Negocio_Fechado = @negocioFechado')
      expect(sql).toContain('v.Encomenda_Cli_PHC LIKE @encomendaCliPHC')
    }
  })

  it('strips null labels so an existing-with-null option never leaks as "(no label)"', async () => {
    const { pool } = poolReturningFacets([
      [{ id: 'C', label: null }],
      [{ id: 'BDAL', label: null }],
      [{ id: 'INSTR', label: null }],
      [{ id: 1, label: null }],
      [{ id: 1, label: null }],
    ])
    const facets = await fetchOrderFacets(pool, {})
    expect(facets.idTpOrder).toEqual([{ id: 'C', label: null }])
    expect(facets.idArea).toEqual([{ id: 'BDAL', label: null }])
    expect(facets.idTipo).toEqual([{ id: 'INSTR', label: null }])
    // The id column is preserved; the label keeps the raw null so the UI can
    // render the canonical "—" placeholder and never invent a category.
  })
})

describe('Dashboard snapshot queries', () => {
  it('aggregates KPI totals, zero-fills the current-year trend, and maps the recognition queue', async () => {
    const pool = poolReturning(
      {
        recordset: [
          {
            ordersBookedYtd: 8,
            amountToInvoice: 999,
            nobYtd: 125000,
            revenueRecognizedYtd: 82000,
            backlogToRecognize: 43000,
            backlogAtPeriodStart: 51000,
          },
        ],
      },
      {
        recordset: [
          { month_num: 1, revenue: 1000, nob: 2000 },
          { month_num: 8, revenue: 8000, nob: 9000 },
        ],
      },
      {
        recordset: [
          {
            ID_Order: 1001,
            encPhc: '5052310',
            orderDate: new Date('2026-08-25T00:00:00.000Z'),
            client: 'Client Alpha',
            area: 'BDAL',
            product: 'ESI TOF',
            type: 'INSTRUMENT',
            sellPrice: 18500,
            recognizedValue: 11562,
            remainingValue: 6938,
            invoiced: 0,
          },
        ],
      },
      { recordset: [] },
      {
        recordset: [
          {
            ID_Order: 2001,
            Encomenda_Cli_PHC: 'W-001',
            Client_Name: 'Client Alpha',
            Area: 'BDAL',
            Tipo: 'INSTRUMENT',
            ID_Tipo: 'INSTR',
            Warranty: 1,
            Warranty_DT_Inicio: null,
            Sell_Price: 15000,
          },
        ],
      },
      {
        recordset: [
          {
            ID_Order: 3001,
            Encomenda_Cli_PHC: 'INV-001',
            Client_Name: 'Client Beta',
            Area: 'BOPT',
            Tipo: 'SERVICE',
            Sell_Price: 12500,
            Total_Faturado: 2500,
            Diferenca: 10000,
          },
        ],
      },
      {
        recordset: [
          {
            ID_Order: 101,
            DT_Order: new Date('2026-08-23T00:00:00.000Z'),
            Order_Factory: 0,
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
            Kit: 0,
            ID_Tp_Warranty: 2,
            Warranty_Reserve: 500,
            Warranty_DT_Inicio: new Date('2026-01-01T00:00:00.000Z'),
            Orc_Proposta: 'PROP-12000',
            PO_Cliente: 'PO-1',
            ID_Tp_Revenue: 1,
            Provisoria: 0,
          },
        ],
      },
      // fetchPendingRecognitionCount
      { recordset: [{ c: 4 }] },
      // fetchWarrantyMissingCount
      { recordset: [{ c: 9 }] },
      // fetchNotFullyInvoicedCount
      { recordset: [{ c: 15 }] },
    )

    const snapshot = await fetchDashboardSnapshot(pool, new Date('2026-08-26T12:00:00.000Z'))

    expect(snapshot.year).toBe(2026)
    expect(snapshot.kpis).toEqual({
      ordersBookedYtd: 8,
      amountToInvoice: 999,
      nobYtd: 125000,
      revenueRecognizedYtd: 82000,
      backlogToRecognize: 43000,
      backlogAtPeriodStart: 51000,
    })
    expect(snapshot.monthlyTrend).toHaveLength(8)
    expect(snapshot.monthlyTrend[0]).toEqual({
      monthStart: '2026-01-01T00:00:00.000Z',
      revenue: 1000,
      nob: 2000,
    })
    expect(snapshot.monthlyTrend[1]).toEqual({
      monthStart: '2026-02-01T00:00:00.000Z',
      revenue: 0,
      nob: 0,
    })
    expect(snapshot.monthlyTrend[7]).toEqual({
      monthStart: '2026-08-01T00:00:00.000Z',
      revenue: 8000,
      nob: 9000,
    })
    expect(snapshot.recognitionQueue).toEqual([
      {
        idOrder: 1001,
        encPhc: '5052310',
        orderDate: '2026-08-25T00:00:00.000Z',
        client: 'Client Alpha',
        area: 'BDAL',
        product: 'ESI TOF',
        type: 'INSTRUMENT',
        sellPrice: 18500,
        recognizedValue: 11562,
        remainingValue: 6938,
        invoiced: false,
      },
    ])
    expect(snapshot.pendingRecognition).toEqual([])
    expect(snapshot.warrantyMissing).toEqual([
      {
        idOrder: 2001,
        encomendaCliPHC: 'W-001',
        client: 'Client Alpha',
        area: 'BDAL',
        type: 'INSTRUMENT',
        idTipo: 'INSTR',
        warranty: true,
        warrantyDtInicio: null,
        sellPrice: 15000,
        idTpWarranty: null,
        warrantyYears: null,
      },
    ])
    expect(snapshot.notFullyInvoiced).toEqual([
      {
        idOrder: 3001,
        encomendaCliPHC: 'INV-001',
        client: 'Client Beta',
        area: 'BOPT',
        type: 'SERVICE',
        sellPrice: 12500,
        totalFaturado: 2500,
        diferenca: 10000,
      },
    ])
    expect(snapshot.recentOrders).toHaveLength(0)
  })

  it('builds the KPI query with Client-only YTD metrics, current backlog, and opening backlog', async () => {
    const captured: Array<{ sql: string; inputs: CapturedInput[] }> = []
    const queryQueue = [
      {
        recordset: [
          {
            ordersBookedYtd: 1,
            amountToInvoice: 6,
            nobYtd: 2,
            revenueRecognizedYtd: 3,
            backlogToRecognize: 4,
            backlogAtPeriodStart: 5,
          },
        ],
      },
      { recordset: [] },
      { recordset: [] },
      { recordset: [] },
      { recordset: [] },
      { recordset: [] },
      { recordset: [] },
      // fetchPendingRecognitionCount
      { recordset: [{ c: 0 }] },
      // fetchWarrantyMissingCount
      { recordset: [{ c: 0 }] },
      // fetchNotFullyInvoicedCount
      { recordset: [{ c: 0 }] },
    ]
    const pool = {
      request: vi.fn(() => {
        const next = queryQueue.shift()
        if (!next) throw new Error('Missing dashboard query result.')
        const current = { sql: '', inputs: [] as CapturedInput[] }
        captured.push(current)
        const request = {
          input: vi.fn((name: string, type: unknown, value: unknown) => {
            current.inputs.push({ name, type, value })
            return request
          }),
          query: vi.fn(async (sql: string) => {
            current.sql = sql
            return next
          }),
        }
        return request
      }),
    } as unknown as ConnectionPool

    await fetchDashboardSnapshot(pool, new Date('2026-08-26T12:00:00.000Z'))

    const kpiQuery = captured[0]
    expect(kpiQuery.inputs).toEqual([
      { name: 'yearStart', type: mssql.DateTime, value: new Date('2026-01-01T00:00:00.000Z') },
      { name: 'todayCutoff', type: mssql.DateTime, value: new Date('2026-08-26T12:00:00.000Z') },
    ])
    expect(kpiQuery.sql).toContain(
      'FROM [dbo].[V_Orders_Nao_Faturadas_Totalmente]) AS amountToInvoice',
    )
    expect(kpiQuery.sql).toContain('FROM [dbo].[V_NOB_Revenue_Backlog_YearlyToday]')
    expect(kpiQuery.sql).toContain('Backlog_Start')
    expect(kpiQuery.sql).toContain('NOB')
    expect(kpiQuery.sql).toContain('Revenue')
    expect(kpiQuery.sql).toContain('Backlog_End')
    expect(kpiQuery.sql).toContain('WHERE Ano = YEAR(@yearStart)')
    expect(kpiQuery.sql).not.toContain('[11-Reconhecimento-PorReconhecer]')
  })

  it('reports the total row counts for the dashboard "showing N out of M" pills', async () => {
    // Mirrors the structure used by the other dashboard tests but expands
    // the mock queue with an extra COUNT(*) result for the pending-
    // recognition total. The fixture mirrors what the backend returns
    // when the underlying views contain more rows than the TOP 10 sample.
    const queryQueue: QueryResult[] = [
      {
        recordset: [
          {
            ordersBookedYtd: 1,
            amountToInvoice: 6,
            nobYtd: 2,
            revenueRecognizedYtd: 3,
            backlogToRecognize: 4,
            backlogAtPeriodStart: 5,
          },
        ],
      },
      // trend query (consumed by buildDashboardTrend)
      { recordset: [] },
      // recognition queue (empty)
      { recordset: [] },
      // pendingRecognition (empty)
      { recordset: [] },
      // pendingRecognitionCount
      { recordset: [{ c: 17 }] },
      // warrantyMissing (empty)
      { recordset: [] },
      // warrantyMissingCount
      { recordset: [{ c: 21 }] },
      // notFullyInvoiced (empty)
      { recordset: [] },
      // notFullyInvoicedCount
      { recordset: [{ c: 14 }] },
      // orderTypeQueues: WPO + SAP rows returned in the same query, but the
      // mock returns only a single combined recordset which the repository
      // filters by ID_Tp_Order. We seed 12 WPO + 7 SAP so the total counts
      // exceed the 10-row sample each.
      {
        recordset: Array.from({ length: 12 }, (_, i) => ({
          ID_Order: 7000 + i,
          ID_Tp_Order: 'WPO',
          Encomenda_Cli_PHC: `WPO-${i}`,
          Client_Name: `WPO Client ${i}`,
        })).concat(
          Array.from({ length: 7 }, (_, i) => ({
            ID_Order: 8000 + i,
            ID_Tp_Order: 'SAP',
            Encomenda_Cli_PHC: `SAP-${i}`,
            Client_Name: `SAP Client ${i}`,
          })),
        ),
      },
    ]
    const pool = {
      request: vi.fn(() => {
        const next = queryQueue.shift()
        if (!next) throw new Error('Missing dashboard query result.')
        return {
          input: vi.fn().mockReturnThis(),
          query: vi.fn(async () => next),
        }
      }),
    } as unknown as ConnectionPool

    const snapshot = await fetchDashboardSnapshot(pool, new Date('2026-08-26T12:00:00.000Z'))

    // The dashboard renders "showing N out of M" when the source count
    // exceeds the 10-row sample. The total counts are populated from the
    // same Promise.all so the UI never has to issue a second request.
    expect(snapshot.pendingRecognitionTotal).toBe(17)
    expect(snapshot.warrantyMissingTotal).toBe(21)
    expect(snapshot.notFullyInvoicedTotal).toBe(14)
    expect(snapshot.waitingPoOrdersTotal).toBe(12)
    expect(snapshot.introduzirSapOrdersTotal).toBe(7)
    // The samples themselves stay bounded at TOP 10 (the frontend shapes
    // "Showing N out of M" with N = rows.length and M = total).
    expect(snapshot.waitingPoOrders).toHaveLength(10)
    expect(snapshot.introduzirSapOrders).toHaveLength(7) // only 7 SAP exist
  })
})

describe('fetchRecognitionQueue', () => {
  it('returns every positive remaining row from the recognition backlog view', async () => {
    const { pool, captured } = capturingPool([
      {
        ID_Order: 1001,
        encPhc: '5052310',
        orderDate: '2026-08-25T00:00:00.000Z',
        client: 'Client Alpha',
        area: 'BDAL',
        product: 'ESI TOF',
        type: 'INSTRUMENT',
        sellPrice: 18500,
        recognizedValue: 11562,
        remainingValue: 6938,
        invoiced: false,
      },
      {
        ID_Order: 1003,
        encPhc: '5052999',
        orderDate: '2026-08-12T00:00:00.000Z',
        client: 'Client Beta',
        area: 'BOPT',
        product: 'XRF',
        type: 'ACESSORIES',
        sellPrice: 87000,
        recognizedValue: 54000,
        remainingValue: 33000,
        invoiced: true,
      },
    ])

    const rows = await fetchRecognitionQueue(pool)

    expect(rows).toEqual([
      {
        idOrder: 1001,
        encPhc: '5052310',
        orderDate: '2026-08-25T00:00:00.000Z',
        client: 'Client Alpha',
        area: 'BDAL',
        product: 'ESI TOF',
        type: 'INSTRUMENT',
        sellPrice: 18500,
        recognizedValue: 11562,
        remainingValue: 6938,
        invoiced: false,
      },
      {
        idOrder: 1003,
        encPhc: '5052999',
        orderDate: '2026-08-12T00:00:00.000Z',
        client: 'Client Beta',
        area: 'BOPT',
        product: 'XRF',
        type: 'ACESSORIES',
        sellPrice: 87000,
        recognizedValue: 54000,
        remainingValue: 33000,
        invoiced: true,
      },
    ])
    expect(captured.sql).toContain('FROM [dbo].[11-Reconhecimento-PorReconhecer] AS v')
    expect(captured.sql).toContain('OUTER APPLY (')
    expect(captured.sql).toContain('WHERE oo.Encomenda_Cli_PHC = v.[Enc PHC]')
    expect(captured.sql).toContain('COALESCE(v.[Valor por Reconhecer], 0) > 0')
    expect(captured.sql).not.toContain('TOP')
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
        Encomenda_Cli_PHC: 'SAP-5590',
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
    expect(order?.Encomenda_Cli_PHC).toBe('SAP-5590')
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

describe('createOrder', () => {
  const validInput = {
    DT_Order: '2026-08-25',
    ID_Tp_Order: 'C',
    ID_Client: 93,
    ID_Area: 'BDAL',
    ID_Tipo: 'INSTR',
    ID_Produto: 2,
    ID_Tp_Revenue: 1,
  } as const

  it('throws ClientNotFoundError before INSERT when the client does not exist', async () => {
    // The existence probe (first query) returns an empty recordset — the INSERT must never run.
    const { pool } = capturingPool([])
    await expect(createOrder(pool, validInput, 'arocha')).rejects.toBeInstanceOf(
      ClientNotFoundError,
    )
  })

  it('runs the existence check against dbo.Client before the INSERT', async () => {
    // capturingPool overwrites captured.sql with the LAST query, so after a successful probe the
    // captured SQL is the INSERT. If the existence check had thrown (no client), the INSERT would
    // never run and captured.sql would be the SELECT — so asserting the INSERT ran proves the
    // probe passed first. The INSERT mock returns an empty recordset (no id), so createOrder
    // throws downstream — that is expected and irrelevant to this assertion.
    const { pool, captured } = capturingPool([{ '': 1 }])
    await expect(createOrder(pool, validInput, 'arocha')).rejects.toThrow(
      'did not return the new order identifier',
    )
    expect(captured.sql).toContain('INSERT INTO [dbo].[Order]')
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

    await expect(updateOrder(pool, 1, { Sell_Price: 100_000, user: 'arocha' })).rejects.toThrow(
      RecognitionCapacityError,
    )
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

    await expect(updateOrder(pool, 1, { Sell_Price: 120_000, user: 'arocha' })).rejects.toThrow(
      FacturacaoCapacityError,
    )
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

    await expect(updateOrder(pool, 1, { Warranty_Reserve: 5_000, user: 'arocha' })).rejects.toThrow(
      RecognitionCapacityError,
    )
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
        recordset: [
          {
            ID_Order: 101,
            ID_Tipo: 'INSTR',
            Tipo_Warranty: 1,
            Sell_Price: 100.0001,
            Warranty_Reserve: 100.0001,
            Warranty_DT_Inicio: new Date('2025-01-08T00:00:00Z'),
            N_Anos: 2,
          },
        ],
      },
      { recordset: [] },
      { recordset: inserted, rowsAffected: [12] },
    )

    await propagateReconhecimento(pool, { orderId: 101, kind: 'warranty' }, 'editor')

    const values = captured[2]?.inputs
      .filter((input) => input.name.startsWith('value'))
      .map((input) => input.value)
    expect(values).toEqual([
      8.3334, 8.3334, 8.3334, 8.3334, 8.3334, 8.3333, 8.3333, 8.3333, 8.3333, 8.3333, 8.3333,
      8.3333,
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
    const { pool, captured } = transactionPool(
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
      {
        orderId: 101,
        kind: 'maintenance',
        startDate: '2027-02-18',
        years: 2,
        recognitionDate: '2027-02-18',
      },
      'editor',
    )
    expect(rows).toHaveLength(24)
    expect(rows[0]).toMatchObject({
      ID_Tp_Reconhecimento: 'CM',
      DT_Reconhecimento: '2027-02-01T00:00:00.000Z',
      Valor_Reconhecimento: 50,
    })
    const dates = captured[2]?.inputs
      .filter((input) => input.name.startsWith('date'))
      .map((input) => (input.value as Date).toISOString())
    expect(dates?.[0]).toBe('2027-02-01T00:00:00.000Z')
    expect(dates?.[23]).toBe('2029-01-01T00:00:00.000Z')
  })

  it('moves elapsed maintenance rows to the recognition month', async () => {
    const expectedDates = [
      ...Array.from({ length: 6 }, () => '2026-06-01T00:00:00.000Z'),
      '2026-07-01T00:00:00.000Z',
      '2026-08-01T00:00:00.000Z',
      '2026-09-01T00:00:00.000Z',
      '2026-10-01T00:00:00.000Z',
      '2026-11-01T00:00:00.000Z',
      '2026-12-01T00:00:00.000Z',
    ]
    const inserted = expectedDates.map((date, index) => ({
      ...current,
      ID_Reconhecimento: 300 + index,
      ID_Tp_Reconhecimento: 'CM',
      DT_Reconhecimento: new Date(date),
      Valor_Reconhecimento: 1000,
    }))
    const { pool, captured } = transactionPool(
      {
        recordset: [
          {
            ID_Order: 101,
            ID_Tipo: 'CM',
            Tipo_Warranty: 0,
            Sell_Price: 12000,
            Warranty_Reserve: null,
            Warranty_DT_Inicio: null,
            N_Anos: null,
          },
        ],
      },
      { recordset: [] },
      { recordset: inserted, rowsAffected: [12] },
    )

    const rows = await propagateReconhecimento(
      pool,
      {
        orderId: 101,
        kind: 'maintenance',
        startDate: '2026-01-15',
        years: 1,
        recognitionDate: '2026-06-25',
      },
      'editor',
    )

    const boundDates = captured[2]?.inputs
      .filter((input) => input.name.startsWith('date'))
      .map((input) => (input.value as Date).toISOString())
    expect(boundDates).toEqual(expectedDates)
    expect(rows).toHaveLength(12)
    expect(rows.reduce((sum, row) => sum + (row.Valor_Reconhecimento ?? 0), 0)).toBe(12000)
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
