import type { ConnectionPool } from 'mssql'
import { createRequire } from 'node:module'
import { numberOrNull, stringOrNull } from './sql-helpers.js'
import type { BacklogReportRow, YearlyBacklogReportRow } from '../types.js'
const mssql = createRequire(import.meta.url)('mssql') as typeof import('mssql')

export interface BacklogReportFilters {
  dataInicial?: string; dataFinal?: string; area?: string; grpReport?: string; produto?: string
}

export async function fetchBacklogReport(pool: ConnectionPool, filters: BacklogReportFilters = {}): Promise<BacklogReportRow[]> {
  const request = pool.request()
  request.input('DataInicial', mssql.Date, filters.dataInicial || null)
  request.input('DataFinal', mssql.Date, filters.dataFinal || null)
  request.input('Area', mssql.NVarChar, filters.area || null)
  request.input('Grp_Report', mssql.NVarChar, filters.grpReport || null)
  request.input('Produto', mssql.NVarChar, filters.produto || null)
  const result = await request.execute<Record<string, unknown>>('dbo.sp_NOB_Revenue_Backlog_Detail_Filter')
  return result.recordset.map((row) => ({
    // The current procedure returns aggregated detail dimensions, not Ano/Mes/ID_Order.
    ano: null, mes: null, idOrder: null,
    idArea: stringOrNull(row.ID_Area), area: stringOrNull(row.Area), idTipo: stringOrNull(row.ID_Tipo),
    tipo: stringOrNull(row.Tipo), idGrpReport: numberOrNull(row.ID_Grp_Report),
    grpReport: stringOrNull(row.Grp_Report), idProduto: numberOrNull(row.ID_Produto),
    produto: stringOrNull(row.Produto), encomendaCliPHC: stringOrNull(row.Encomenda_Cli_PHC),
    backlogStart: numberOrNull(row.Backlog_Start) ?? 0, nob: numberOrNull(row.NOB) ?? 0,
    revenue: numberOrNull(row.Revenue) ?? 0, backlogEnd: numberOrNull(row.Backlog_End) ?? 0,
  }))
}

export async function fetchBacklogTodayReport(pool: ConnectionPool): Promise<BacklogReportRow[]> {
  const result = await pool.request().query<Record<string, unknown>>(`
    SELECT Ano, ID_Area, Area, ID_Tipo, Tipo, ID_Grp_Report, Grp_Report,
      Backlog_Start, NOB, Revenue, Backlog_End
    FROM [dbo].[V_NOB_Revenue_Backlog_DetailToday]
    ORDER BY Ano DESC, Area ASC, Grp_Report ASC, Tipo ASC
  `)
  return result.recordset.map((row) => ({
    ano: numberOrNull(row.Ano), mes: null, idOrder: null,
    idArea: stringOrNull(row.ID_Area), area: stringOrNull(row.Area), idTipo: stringOrNull(row.ID_Tipo),
    tipo: stringOrNull(row.Tipo), idGrpReport: numberOrNull(row.ID_Grp_Report),
    grpReport: stringOrNull(row.Grp_Report), idProduto: null, produto: null, encomendaCliPHC: null,
    backlogStart: numberOrNull(row.Backlog_Start) ?? 0, nob: numberOrNull(row.NOB) ?? 0,
    revenue: numberOrNull(row.Revenue) ?? 0, backlogEnd: numberOrNull(row.Backlog_End) ?? 0,
  }))
}

export async function fetchBacklogYearlyTodayReport(pool: ConnectionPool): Promise<YearlyBacklogReportRow[]> {
  const result = await pool.request().query<Record<string, unknown>>(`
    SELECT Ano, Backlog_Start, NOB, Revenue, Backlog_End
    FROM [dbo].[V_NOB_Revenue_Backlog_YearlyToday]
    ORDER BY Ano DESC
  `)
  return result.recordset.map((row) => ({
    ano: numberOrNull(row.Ano),
    backlogStart: numberOrNull(row.Backlog_Start) ?? 0,
    nob: numberOrNull(row.NOB) ?? 0,
    revenue: numberOrNull(row.Revenue) ?? 0,
    backlogEnd: numberOrNull(row.Backlog_End) ?? 0,
  }))
}
