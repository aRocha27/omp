/**
 * Single source of truth for translating `OrderListFilters` into
 * parameterized SQL predicates + bindings.
 *
 * The audit found the same 11 predicates copy-pasted across three sites
 * (the inline loop inside `fetchOrderSummaries`, the `base(excluded)`
 * closure inside `fetchOrderFacets`, and the standalone
 * `addOrderFacetInputs` helper). Centralise them here so a new facet
 * only needs to be added once.
 *
 * All values are bound as parameters (never interpolated into the SQL),
 * so there is no injection surface; only the placeholder count is
 * dynamic. SQL Server has a hard limit of 2100 parameters per query —
 * the frontend reference-data sets are far below that.
 *
 * The `tableAlias` parameter lets `fetchOrderSummaries` use `v.…` (the
 * view alias) while `fetchOrderFacets` does the same. `fetchOrderFacets`
 * also needs to pass an `excluded` field so the SELECT for facet X
 * ignores X's own filter — this is the "faceted" semantics.
 */
import { createRequire } from 'node:module'
import type { Request as SqlRequest } from 'mssql'
import { placeholders } from '../sql-helpers.js'
import type { OrderListFilters } from '../../types/filters.js'

const mssql = createRequire(import.meta.url)('mssql') as typeof import('mssql')

/** Columns the filter logic touches. Adding one here means adding one
 *  branch to `addOrderFiltersInputs` + one branch to `buildOrderFiltersWhere`. */
export type OrderFilterKey = keyof OrderListFilters

/**
 * Bind every present filter to the request as a parameter. Categoricals
 * expand into `${name}0`, `${name}1`, … matching the placeholders that
 * `buildOrderFiltersWhere` produces.
 */
export function addOrderFiltersInputs(request: SqlRequest, filters: OrderListFilters): void {
  if (filters.dateFrom) request.input('dateFrom', mssql.NVarChar, filters.dateFrom)
  if (filters.dateTo) request.input('dateTo', mssql.NVarChar, filters.dateTo)
  if (filters.clientName) request.input('clientName', mssql.NVarChar, `%${filters.clientName}%`)
  if (filters.orderFactory !== undefined)
    request.input('orderFactory', mssql.Bit, filters.orderFactory)
  if (filters.negocioFechado !== undefined)
    request.input('negocioFechado', mssql.Bit, filters.negocioFechado)
  for (const [name, values, type] of [
    ['idTpOrder', filters.idTpOrder, mssql.NVarChar],
    ['idArea', filters.idArea, mssql.NVarChar],
    ['idTipo', filters.idTipo, mssql.NVarChar],
    ['idProduto', filters.idProduto, mssql.Int],
    ['idInstrumento', filters.idInstrumento, mssql.Int],
  ] as const) {
    values?.forEach((value, index) => request.input(`${name}${index}`, type, value))
  }
  if (filters.encomendaCliPHC)
    request.input('encomendaCliPHC', mssql.NVarChar, `%${filters.encomendaCliPHC}%`)
  if (filters.invoiceNumber)
    request.input('invoiceNumber', mssql.NVarChar, `%${filters.invoiceNumber}%`)
}

/**
 * Build the WHERE clause (without the `WHERE` keyword) from the same set
 * of predicates. `excluded` lets a facet query drop its own filter so the
 * SELECT can offer values that the user is currently filtering out.
 *
 * Each clause is prefixed by `tableAlias.` so the helper works for
 * queries against `v` (the view) and could be adapted to the base table.
 */
export function buildOrderFiltersWhere(
  filters: OrderListFilters,
  tableAlias = 'v',
  excluded?: OrderFilterKey,
): string {
  const where: string[] = []
  if (excluded !== 'dateFrom' && filters.dateFrom) where.push(`${tableAlias}.DT_Order >= @dateFrom`)
  if (excluded !== 'dateTo' && filters.dateTo) {
    // Half-open upper bound: an inclusive `dateTo` of "2025-09-12" must cover rows at
    // 2025-09-12 14:00. A bare `<=` on a datetime would drop them. DATEADD runs server-side.
    where.push(`${tableAlias}.DT_Order < DATEADD(day, 1, @dateTo)`)
  }
  if (excluded !== 'clientName' && filters.clientName)
    where.push(`${tableAlias}.nome LIKE @clientName`)
  if (excluded !== 'orderFactory' && filters.orderFactory !== undefined) {
    where.push(`${tableAlias}.Order_Factory = @orderFactory`)
  }
  if (excluded !== 'negocioFechado' && filters.negocioFechado !== undefined) {
    where.push(`${tableAlias}.Negocio_Fechado = @negocioFechado`)
  }
  if (excluded !== 'idTpOrder' && filters.idTpOrder?.length) {
    where.push(
      `${tableAlias}.ID_Tp_Order IN (${placeholders('idTpOrder', filters.idTpOrder.length)})`,
    )
  }
  if (excluded !== 'idArea' && filters.idArea?.length) {
    where.push(`${tableAlias}.ID_Area IN (${placeholders('idArea', filters.idArea.length)})`)
  }
  if (excluded !== 'idTipo' && filters.idTipo?.length) {
    where.push(`${tableAlias}.ID_Tipo IN (${placeholders('idTipo', filters.idTipo.length)})`)
  }
  if (excluded !== 'idProduto' && filters.idProduto?.length) {
    where.push(
      `${tableAlias}.ID_Produto IN (${placeholders('idProduto', filters.idProduto.length)})`,
    )
  }
  if (excluded !== 'idInstrumento' && filters.idInstrumento?.length) {
    where.push(
      `${tableAlias}.ID_Instrumento IN (${placeholders('idInstrumento', filters.idInstrumento.length)})`,
    )
  }
  if (excluded !== 'encomendaCliPHC' && filters.encomendaCliPHC) {
    where.push(`${tableAlias}.Encomenda_Cli_PHC LIKE @encomendaCliPHC`)
  }
  if (excluded !== 'invoiceNumber' && filters.invoiceNumber) {
    where.push(
      `EXISTS (SELECT 1 FROM [dbo].[Facturacao] AS f WHERE f.ID_Order = ${tableAlias}.ID_Order AND f.N_Doc_FT LIKE @invoiceNumber)`,
    )
  }
  return where.join(' AND ')
}
