/**
 * Recognition report repository tests — focused on the new faceted
 * `fetchRecognitionReportFacets` so each dimension's DISTINCT runs against
 * every active filter except its own (the exclude-own-facet contract).
 *
 * The capture-pool pattern mirrors `db.test.ts`: bound parameters and final
 * SQL are inspected per query so we can assert the WHERE clauses carry the
 * expected combinations of predicates.
 */
import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'
import type { ConnectionPool } from 'mssql'
import {
  fetchRecognitionReport,
  fetchRecognitionReportFacets,
  fetchRecognitionReportOptions,
} from './recognition-report.repository.js'

const mssql = createRequire(import.meta.url)('mssql') as typeof import('mssql')

type CapturedInput = { name: string; type: unknown; value: unknown }
type CapturedRequest = { inputs: CapturedInput[]; sql: string }
type CapturedRow = Record<string, unknown>
type ResultPlan = { recordset: CapturedRow[] }

function capturingPool(plan: ResultPlan[]) {
  const captured: CapturedRequest[] = []
  const queue = [...plan]
  const pool = {
    request: vi.fn(() => {
      // Each pool.request() call creates a fresh request with its own
      // inputs buffer so a single test can capture multiple queries
      // without bleeding bindings across requests.
      const current: CapturedRequest = { inputs: [], sql: '' }
      captured.push(current)
      const requestObj = {
        input: vi.fn().mockImplementation((name: string, type: unknown, value: unknown) => {
          current.inputs.push({ name, type, value })
          return requestObj
        }),
        query: vi.fn().mockImplementation(async (sql: string) => {
          current.sql = sql
          const next = queue.shift() ?? { recordset: [] }
          return next
        }),
      }
      return requestObj
    }),
  } as unknown as ConnectionPool
  return { pool, captured }
}

const YEAR = (value: number | null) => ({ id: value, label: value })
const AREA = (value: string | null) => ({ id: value, label: value })
const GRP = (value: string | null) => ({ id: value, label: value })
const TIPO = (value: string | null) => ({ id: value, label: value })
const PRODUTO = (value: string | null) => ({ id: value, label: value })
const ENC = (value: string | null) => ({ id: value, label: value })
const TP = (value: string | null) => ({ id: value, label: value })

describe('Recognition facets query (faceted filtering)', () => {
  it('runs every facet against V_Reconhecimento_Monthly_Crosstab and excludes its own filter (no filters)', async () => {
    const { pool, captured } = capturingPool([
      { recordset: [YEAR(2025)] },
      { recordset: [AREA('BOPT')] },
      { recordset: [GRP('Service')] },
      { recordset: [TIPO('INSTRUMENT')] },
      { recordset: [PRODUTO('Maldi-TOF')] },
      { recordset: [ENC('PHC-2001')] },
      { recordset: [TP('Parcial')] },
    ])

    const facets = await fetchRecognitionReportFacets(pool, {})
    expect(facets).toEqual({
      yearRecognition: [{ id: 2025, label: '2025' }],
      area: [{ id: 'BOPT', label: 'BOPT' }],
      grpReport: [{ id: 'Service', label: 'Service' }],
      tipo: [{ id: 'INSTRUMENT', label: 'INSTRUMENT' }],
      produto: [{ id: 'Maldi-TOF', label: 'Maldi-TOF' }],
      encomendaCliPHC: [{ id: 'PHC-2001', label: 'PHC-2001' }],
      tpReconhecimento: [{ id: 'Parcial', label: 'Parcial' }],
    })
    // 7 queries, one per facet dimension.
    expect(captured.length).toBe(7)
    for (const entry of captured) {
      expect(entry.sql).toContain('FROM [dbo].[V_Reconhecimento_Monthly_Crosstab] AS v')
      expect(entry.sql).toContain('DISTINCT')
      // No active filters → no WHERE clause.
      expect(entry.sql).not.toContain('WHERE')
    }
  })

  it('applies every active filter to every facet and excludes the own-facet one', async () => {
    const { pool, captured } = capturingPool([
      { recordset: [YEAR(2025)] },
      { recordset: [AREA('BDAL')] },
      { recordset: [GRP('Product')] },
      { recordset: [TIPO('INSTRUMENT')] },
      { recordset: [PRODUTO('Maldi-TOF')] },
      { recordset: [ENC('PHC-2001')] },
      { recordset: [TP('Parcial')] },
    ])

    await fetchRecognitionReportFacets(pool, {
      area: ['BDAL'],
      tipo: ['INSTRUMENT'],
      yearRecognition: [2025],
      tpReconhecimento: ['Parcial'],
    })

    // yearRecognition: sees every active filter except yearRecognition itself.
    expect(captured[0].sql).toContain("v.Area IN (@area0)")
    expect(captured[0].sql).toContain("v.Tipo IN (@tipo0)")
    expect(captured[0].sql).toContain("v.Tp_Reconhecimento IN (@tpReconhecimento0)")
    expect(captured[0].sql).not.toContain('Year_Recognition IN')

    // area: must NOT carry its own predicate.
    expect(captured[1].sql).toContain("v.Tipo IN (@tipo0)")
    expect(captured[1].sql).not.toContain("v.Area IN")

    // grpReport: own predicate excluded.
    expect(captured[2].sql).toContain("v.Area IN (@area0)")
    expect(captured[2].sql).toContain("v.Tipo IN (@tipo0)")
    expect(captured[2].sql).not.toContain("v.Grp_Report IN")

    // tpReconhecimento: own predicate excluded.
    expect(captured[6].sql).toContain("v.Area IN (@area0)")
    expect(captured[6].sql).toContain("v.Tipo IN (@tipo0)")
    expect(captured[6].sql).not.toContain("v.Tp_Reconhecimento IN")
  })

  it('preserves null rows (Year_Recognition = null survives the DISTINCT)', async () => {
    const { pool } = capturingPool([
      { recordset: [YEAR(null)] },
      { recordset: [AREA('BOPT')] },
      { recordset: [GRP('Service')] },
      { recordset: [TIPO('SERVICE')] },
      { recordset: [PRODUTO('GC-MS')] },
      { recordset: [ENC('PHC-3002')] },
      { recordset: [TP('Parcial')] },
    ])
    const facets = await fetchRecognitionReportFacets(pool, {})
    // The `id` carries the canonical value (null for the future-dated row),
    // the `label` is its string form (also null when the source is null so
    // the UI can render a muted slot — never the raw id).
    expect(facets.yearRecognition).toEqual([{ id: null, label: null }])
    expect(facets.area).toEqual([{ id: 'BOPT', label: 'BOPT' }])
  })

  it('binds parameters with the right SQL types', async () => {
    const { pool, captured } = capturingPool([
      { recordset: [YEAR(2025)] },
      { recordset: [AREA('BDAL')] },
      { recordset: [GRP('Product')] },
      { recordset: [TIPO('INSTRUMENT')] },
      { recordset: [PRODUTO('Maldi-TOF')] },
      { recordset: [ENC('PHC-2001')] },
      { recordset: [TP('Parcial')] },
    ])
    await fetchRecognitionReportFacets(pool, {
      yearRecognition: [2025, 2026],
      area: ['BDAL', 'BOPT'],
    })

    const yearInputs = captured[0].inputs.filter((entry) => entry.name.startsWith('yearRecognition'))
    expect(yearInputs.map((entry) => entry.value)).toEqual([2025, 2026])
    expect(yearInputs.every((entry) => entry.type === mssql.Int)).toBe(true)

    const stringInputs = captured[0].inputs.filter((entry) => entry.name.startsWith('area'))
    expect(stringInputs.map((entry) => entry.value)).toEqual(['BDAL', 'BOPT'])
    expect(stringInputs.every((entry) => entry.type === mssql.NVarChar)).toBe(true)
  })

  it('reuses the same WHERE/bind helpers as fetchRecognitionReport (parity)', async () => {
    const { pool, captured } = capturingPool([
      { recordset: [] },
      { recordset: [] },
      { recordset: [] },
      { recordset: [] },
      { recordset: [] },
      { recordset: [] },
      { recordset: [] },
    ])
    const filters = { area: ['BDAL'], tipo: ['INSTRUMENT'] }
    await fetchRecognitionReportFacets(pool, filters)
    // Each facet's WHERE must be the same shape that fetchRecognitionReport
    // would build for the same filter set — just with its own dimension
    // excluded. Sample the area-facet and the tipo-facet SQL strings to
    // prove they share the WHERE layout.
    const areaSql = captured[1].sql
    expect(areaSql).toMatch(/WHERE v\.Tipo IN \(@tipo0\)/)
    expect(areaSql).not.toMatch(/v\.Area IN/)

    const tipoSql = captured[3].sql
    expect(tipoSql).toMatch(/WHERE v\.Area IN \(@area0\)/)
    expect(tipoSql).not.toMatch(/v\.Tipo IN/)
  })

  it('fetchRecognitionReportOptions still works for the legacy GET endpoint (uses facets internally)', async () => {
    const { pool, captured } = capturingPool([
      { recordset: [YEAR(2025), YEAR(2024)] },
      { recordset: [AREA('BDAL'), AREA('BOPT')] },
      { recordset: [GRP('Product'), GRP('Service')] },
      { recordset: [TIPO('CM'), TIPO('INSTRUMENT'), TIPO('SERVICE')] },
      { recordset: [PRODUTO('Maldi-TOF'), PRODUTO('NIR')] },
      { recordset: [ENC('PHC-2001'), ENC('PHC-2002'), ENC('PHC-3001')] },
      { recordset: [TP('Parcial'), TP('Total')] },
    ])
    const options = await fetchRecognitionReportOptions(pool)
    // Backwards-compatible flat shape.
    expect(options.years).toEqual([2025, 2024])
    expect(options.areas).toEqual(['BDAL', 'BOPT'])
    expect(options.tipos).toEqual(['CM', 'INSTRUMENT', 'SERVICE'])
    expect(options.produtos).toEqual(['Maldi-TOF', 'NIR'])
    expect(options.tpReconhecimentos).toEqual(['Parcial', 'Total'])
    expect(captured.length).toBe(7)
  })
})

describe('Recognition list query uses the same WHERE builder as facets (parity)', () => {
  it('builds the same WHERE for the same filter set', async () => {
    const { pool, captured } = capturingPool([
      { recordset: [{ Year_Recognition: 2025, Area: 'BDAL' }] },
    ])
    const filters = { area: ['BDAL'], tipo: ['INSTRUMENT'] }
    await fetchRecognitionReport(pool, filters)
    const sql = captured[0].sql
    expect(sql).toContain("v.Area IN (@area0)")
    expect(sql).toContain("v.Tipo IN (@tipo0)")
    expect(sql).toContain('ORDER BY v.Year_Recognition DESC, v.Area ASC, v.Cliente ASC')
  })
})