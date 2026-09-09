import { createRequire } from 'node:module'
import type { ConnectionPool, Request as SqlRequest } from 'mssql'
import { numberOrNull, placeholders, stringOrNull } from './sql-helpers.js'
import type { RecognitionReportOptions, RecognitionReportRow } from '../types.js'

const mssql = createRequire(import.meta.url)('mssql') as typeof import('mssql')
const ORDERS_SCHEMA = 'dbo'
const RECOGNITION_MONTHLY_VIEW = 'V_Reconhecimento_Monthly_Crosstab'

/** Filters for the Recognition crosstab. All fields optional; empty/empty
 * arrays mean "no filter". Mirrors the wire shape from the frontend. */
export interface RecognitionReportFilters {
  yearRecognition?: number[]
  area?: string[]
  grpReport?: string[]
  tipo?: string[]
  produto?: string[]
  encomendaCliPHC?: string[]
  tpReconhecimento?: string[]
}

/** Each filterable dimension on the Recognition crosstab. */
export type RecognitionFilterKey = keyof RecognitionReportFilters

/** The faceted response — every filterable dimension rendered as a DISTINCT
 * list of values that coexist with the rest of the active filters. `null`
 * entries (e.g. a row with `Year_Recognition = null` because the year could
 * not be derived) are preserved so the UI shows them in a muted slot. */
export interface RecognitionReportFacets {
  yearRecognition: Array<{ id: number | null; label: string | null }>
  area: Array<{ id: string | null; label: string | null }>
  grpReport: Array<{ id: string | null; label: string | null }>
  tipo: Array<{ id: string | null; label: string | null }>
  produto: Array<{ id: string | null; label: string | null }>
  encomendaCliPHC: Array<{ id: string | null; label: string | null }>
  tpReconhecimento: Array<{ id: string | null; label: string | null }>
}

interface FilterSpec {
  /** Filter key on the wire (`RecognitionReportFilters` key). */
  filterKey: RecognitionFilterKey
  /** SQL column to SELECT DISTINCT on (the canonical label lives on the view). */
  column: string
}

/**
 * Canonical list of filterable dimensions. Each entry maps a filter key to
 * the SQL column that carries the canonical id+label inside the view. Adding
 * a new filter dimension means appending one entry here AND extending the
 * Zod schema in `validation/reference.ts` — nowhere else.
 */
const FILTER_SPECS: readonly FilterSpec[] = [
  { filterKey: 'yearRecognition', column: 'Year_Recognition' },
  { filterKey: 'area', column: 'Area' },
  { filterKey: 'grpReport', column: 'Grp_Report' },
  { filterKey: 'tipo', column: 'Tipo' },
  { filterKey: 'produto', column: 'Produto' },
  { filterKey: 'encomendaCliPHC', column: 'Encomenda_Cli_PHC' },
  { filterKey: 'tpReconhecimento', column: 'Tp_Reconhecimento' },
]

/**
 * Bind every active filter to the request as a parameter. Same names as
 * `addOrderFiltersInputs` so a future consolidation of the two helpers is
 * mechanical.
 */
export function addRecognitionFiltersInputs(
  request: SqlRequest,
  filters: RecognitionReportFilters,
): void {
  for (const { filterKey } of FILTER_SPECS) {
    const values = filters[filterKey]
    if (!values || values.length === 0) continue
    const type = filterKey === 'yearRecognition' ? mssql.Int : mssql.NVarChar
    values.forEach((value, index) => request.input(`${filterKey}${index}`, type, value))
  }
}

/**
 * Build the WHERE clause (without the `WHERE` keyword) from the same set
 * of predicates. `excluded` lets a facet query drop its own filter so the
 * SELECT can offer values that the user is currently filtering out (the
 * exclude-own-facet contract from the spec).
 */
export function buildRecognitionFiltersWhere(
  filters: RecognitionReportFilters,
  excluded?: RecognitionFilterKey,
): string {
  const where: string[] = []
  for (const { filterKey, column } of FILTER_SPECS) {
    if (excluded === filterKey) continue
    const values = filters[filterKey]
    if (!values || values.length === 0) continue
    where.push(`v.${column} IN (${placeholders(filterKey, values.length)})`)
  }
  return where.join(' AND ')
}

/**
 * Read the rows that satisfy the active filters (no exclude-own semantics —
 * every active filter narrows the row set).
 */
export async function fetchRecognitionReport(
  pool: ConnectionPool,
  filters: RecognitionReportFilters,
  limit?: number,
): Promise<RecognitionReportRow[]> {
  const request = pool.request()
  addRecognitionFiltersInputs(request, filters)
  const where = buildRecognitionFiltersWhere(filters)
  if (limit != null) request.input('limit', mssql.Int, limit)
  const result = await request.query<Record<string, unknown>>(
    `SELECT ${limit != null ? 'TOP (@limit)' : ''}
       v.Year_Recognition,
       v.Area,
       v.Grp_Report,
       v.Tipo,
       v.Produto,
       v.Encomenda_Cli_PHC,
       v.Cliente,
       v.Sell_Price,
       v.Tp_Reconhecimento,
       v.January, v.February, v.March, v.April, v.May, v.June,
       v.July, v.August, v.September, v.October, v.November, v.December,
       v.Total_Year
     FROM [${ORDERS_SCHEMA}].[${RECOGNITION_MONTHLY_VIEW}] AS v
     ${where ? `WHERE ${where}` : ''}
     ORDER BY v.Year_Recognition DESC, v.Area ASC, v.Cliente ASC`,
  )
  return result.recordset.map(toRecognitionReportRow)
}

/**
 * Read the distinct values that coexist with the active filters — every
 * dimension's DISTINCT is computed against the rows that survive every
 * OTHER filter, with the dimension's own filter excluded (the standard
 * "faceted filtering" / "exclude-own-facet" semantics). The whole set
 * shares `addRecognitionFiltersInputs` + `buildRecognitionFiltersWhere`
 * with `fetchRecognitionReport`, so the option set cannot drift from the
 * row set.
 *
 * The result is computed in 7 SELECTs (one per dimension). SQL Server has
 * a 2100-parameter limit, well above the handful of id values we bind here.
 */
export async function fetchRecognitionReportFacets(
  pool: ConnectionPool,
  filters: RecognitionReportFilters,
): Promise<RecognitionReportFacets> {
  const result: RecognitionReportFacets = {
    yearRecognition: [],
    area: [],
    grpReport: [],
    tipo: [],
    produto: [],
    encomendaCliPHC: [],
    tpReconhecimento: [],
  }
  for (const spec of FILTER_SPECS) {
    const request = pool.request()
    addRecognitionFiltersInputs(request, filters)
    const where = buildRecognitionFiltersWhere(filters, spec.filterKey)
    const rows = await request.query<Record<string, unknown>>(
      `SELECT DISTINCT v.${spec.column} AS id, v.${spec.column} AS label
       FROM [${ORDERS_SCHEMA}].[${RECOGNITION_MONTHLY_VIEW}] AS v
       ${where ? `WHERE ${where}` : ''}`,
    )
    if (spec.filterKey === 'yearRecognition') {
      result.yearRecognition = rows.recordset.map((row) => {
        const value = numberOrNull(row.id)
        return { id: value, label: value === null ? null : String(value) }
      })
    } else {
      const bucket = result[spec.filterKey] as Array<{ id: string | null; label: string | null }>
      for (const row of rows.recordset) {
        bucket.push({ id: stringOrNull(row.id), label: stringOrNull(row.label) })
      }
    }
  }
  return result
}

/** Backwards-compatible options endpoint — returns the universe of options
 * for every dimension when no filters are active. Internally delegated to
 * `fetchRecognitionReportFacets` so the wire contract stays in one place.
 */
export async function fetchRecognitionReportOptions(
  pool: ConnectionPool,
): Promise<RecognitionReportOptions> {
  const facets = await fetchRecognitionReportFacets(pool, {})
  return {
    years: facets.yearRecognition
      .map((entry) => entry.id)
      .filter((value): value is number => typeof value === 'number')
      .sort((a, b) => b - a),
    areas: facets.area
      .map((entry) => entry.id)
      .filter((value): value is string => typeof value === 'string')
      .sort(),
    grpReports: facets.grpReport
      .map((entry) => entry.id)
      .filter((value): value is string => typeof value === 'string')
      .sort(),
    tipos: facets.tipo
      .map((entry) => entry.id)
      .filter((value): value is string => typeof value === 'string')
      .sort(),
    produtos: facets.produto
      .map((entry) => entry.id)
      .filter((value): value is string => typeof value === 'string')
      .sort(),
    encomendas: facets.encomendaCliPHC
      .map((entry) => entry.id)
      .filter((value): value is string => typeof value === 'string')
      .sort(),
    tpReconhecimentos: facets.tpReconhecimento
      .map((entry) => entry.id)
      .filter((value): value is string => typeof value === 'string')
      .sort(),
  }
}

function toRecognitionReportRow(row: Record<string, unknown>): RecognitionReportRow {
  return {
    yearRecognition: numberOrNull(row.Year_Recognition),
    area: stringOrNull(row.Area),
    grpReport: stringOrNull(row.Grp_Report),
    tipo: stringOrNull(row.Tipo),
    produto: stringOrNull(row.Produto),
    encomendaCliPHC: stringOrNull(row.Encomenda_Cli_PHC),
    cliente: stringOrNull(row.Cliente),
    sellPrice: numberOrNull(row.Sell_Price),
    tpReconhecimento: stringOrNull(row.Tp_Reconhecimento),
    january: numberOrNull(row.January) ?? 0,
    february: numberOrNull(row.February) ?? 0,
    march: numberOrNull(row.March) ?? 0,
    april: numberOrNull(row.April) ?? 0,
    may: numberOrNull(row.May) ?? 0,
    june: numberOrNull(row.June) ?? 0,
    july: numberOrNull(row.July) ?? 0,
    august: numberOrNull(row.August) ?? 0,
    september: numberOrNull(row.September) ?? 0,
    october: numberOrNull(row.October) ?? 0,
    november: numberOrNull(row.November) ?? 0,
    december: numberOrNull(row.December) ?? 0,
    totalYear: numberOrNull(row.Total_Year) ?? 0,
  }
}