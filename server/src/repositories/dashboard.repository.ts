import { createRequire } from 'node:module'
import type { ConnectionPool } from 'mssql'
import { booleanOrNull, dateTimeOrNull, numberOrNull, stringOrNull } from './sql-helpers.js'
import type {
  DashboardRecognitionQueueRow,
  DashboardPendingRecognitionRow,
  DashboardSnapshotRow,
  DashboardWarrantyMissingRow,
  InvoicingPendingRow,
} from '../types.js'

const mssql = createRequire(import.meta.url)('mssql') as typeof import('mssql')
const ORDERS_SCHEMA = 'dbo'
const ORDERS_TABLE = 'Order'
const RECONHECIMENTO_TABLE = 'Reconhecimento'
const RECOGNITION_BACKLOG_VIEW = '11-Reconhecimento-PorReconhecer'

/** Rolling window size (months) for the monthly trend chart. */
const TREND_WINDOW = 7

function firstUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function addUtcMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
}

export async function fetchDashboardSnapshot(
  pool: ConnectionPool,
  today: Date = new Date(),
): Promise<DashboardSnapshotRow> {
  const year = today.getUTCFullYear()
  // Rolling 7-month window ending at the current month (handles the year
  // transition automatically: in January we still see July–December of the
  // previous year, in February we see August–December + January, and so on).
  const trendWindowStart = addUtcMonths(
    new Date(Date.UTC(year, today.getUTCMonth(), 1)),
    -(TREND_WINDOW - 1),
  )
  const yearStart = new Date(Date.UTC(year, 0, 1))
  const todayCutoff = today

  const kpisRequest = pool.request()
  kpisRequest.input('yearStart', mssql.DateTime, yearStart)
  kpisRequest.input('todayCutoff', mssql.DateTime, todayCutoff)
  const kpisPromise = kpisRequest.query<Record<string, unknown>>(
    `SELECT
        (SELECT COUNT(*)
         FROM [${ORDERS_SCHEMA}].[${ORDERS_TABLE}]
         WHERE DT_Order >= @yearStart AND DT_Order < @todayCutoff) AS ordersBookedYtd,
        (SELECT COALESCE(SUM(COALESCE(Diferenca, 0)), 0)
         FROM [${ORDERS_SCHEMA}].[V_Orders_Nao_Faturadas_Totalmente]) AS amountToInvoice,
         (SELECT COALESCE(Backlog_Start, 0)
          FROM [${ORDERS_SCHEMA}].[V_NOB_Revenue_Backlog_YearlyToday]
          WHERE Ano = YEAR(@yearStart)) AS backlogAtPeriodStart,
         (SELECT COALESCE(NOB, 0)
          FROM [${ORDERS_SCHEMA}].[V_NOB_Revenue_Backlog_YearlyToday]
          WHERE Ano = YEAR(@yearStart)) AS nobYtd,
         (SELECT COALESCE(Revenue, 0)
          FROM [${ORDERS_SCHEMA}].[V_NOB_Revenue_Backlog_YearlyToday]
          WHERE Ano = YEAR(@yearStart)) AS revenueRecognizedYtd,
         (SELECT COALESCE(Backlog_End, 0)
          FROM [${ORDERS_SCHEMA}].[V_NOB_Revenue_Backlog_YearlyToday]
          WHERE Ano = YEAR(@yearStart)) AS backlogToRecognize`,
  )

  const trendRequest = pool.request()
  trendRequest.input('trendStart', mssql.DateTime, trendWindowStart)
  trendRequest.input('todayCutoff', mssql.DateTime, todayCutoff)
  const trendPromise = trendRequest.query<Record<string, unknown>>(
    `SELECT month_year, month_num, SUM(revenue) AS revenue, SUM(nob) AS nob
      FROM (
        SELECT YEAR(DT_Reconhecimento) AS month_year,
               MONTH(DT_Reconhecimento) AS month_num,
               COALESCE(SUM(COALESCE(Valor_Reconhecimento, 0)), 0) AS revenue,
               CAST(0 AS money) AS nob
        FROM [${ORDERS_SCHEMA}].[${RECONHECIMENTO_TABLE}]
        WHERE DT_Reconhecimento >= @trendStart AND DT_Reconhecimento < @todayCutoff
        GROUP BY YEAR(DT_Reconhecimento), MONTH(DT_Reconhecimento)
        UNION ALL
        SELECT YEAR(DT_Order) AS month_year,
               MONTH(DT_Order) AS month_num,
               CAST(0 AS money) AS revenue,
               COALESCE(SUM(COALESCE(Sell_Price, 0)), 0) AS nob
        FROM [${ORDERS_SCHEMA}].[${ORDERS_TABLE}]
        WHERE DT_Order >= @trendStart AND DT_Order < @todayCutoff
        GROUP BY YEAR(DT_Order), MONTH(DT_Order)
      ) AS trend
     GROUP BY month_year, month_num
     ORDER BY month_year, month_num`,
  )

  const [
    kpisResult,
    trendResult,
    recognitionQueue,
    pendingRecognition,
    pendingRecognitionCount,
    warrantyMissing,
    warrantyMissingCount,
    notFullyInvoiced,
    notFullyInvoicedCount,
    orderTypeQueues,
  ] = await Promise.all([
    kpisPromise,
    trendPromise,
    fetchRecognitionQueue(pool),
    fetchPendingRecognition(pool, 10),
    fetchPendingRecognitionCount(pool),
    fetchWarrantyMissing(pool, 10),
    fetchWarrantyMissingCount(pool),
    fetchNotFullyInvoiced(pool, 10),
    fetchNotFullyInvoicedCount(pool),
    fetchDashboardOrderTypeQueues(pool),
  ])

  return {
    year,
    kpis: {
      ordersBookedYtd: numberOrNull(kpisResult.recordset[0]?.ordersBookedYtd) ?? 0,
      amountToInvoice: numberOrNull(kpisResult.recordset[0]?.amountToInvoice) ?? 0,
      nobYtd: numberOrNull(kpisResult.recordset[0]?.nobYtd) ?? 0,
      revenueRecognizedYtd: numberOrNull(kpisResult.recordset[0]?.revenueRecognizedYtd) ?? 0,
      backlogToRecognize: numberOrNull(kpisResult.recordset[0]?.backlogToRecognize) ?? 0,
      backlogAtPeriodStart: numberOrNull(kpisResult.recordset[0]?.backlogAtPeriodStart) ?? 0,
    },
    monthlyTrend: buildDashboardTrend(trendResult.recordset, trendWindowStart),
    recognitionQueue,
    pendingRecognition,
    pendingRecognitionTotal: pendingRecognitionCount,
    warrantyMissing,
    warrantyMissingTotal: warrantyMissingCount,
    notFullyInvoiced,
    notFullyInvoicedTotal: notFullyInvoicedCount,
    recentOrders: [],
    waitingPoOrders: orderTypeQueues.waitingPoOrders,
    waitingPoOrdersTotal: orderTypeQueues.waitingPoOrdersTotal,
    introduzirSapOrders: orderTypeQueues.introduzirSapOrders,
    introduzirSapOrdersTotal: orderTypeQueues.introduzirSapOrdersTotal,
  }
}

export async function fetchPendingRecognition(
  pool: ConnectionPool,
  limit?: number,
): Promise<DashboardPendingRecognitionRow[]> {
  const request = pool.request()
  if (limit != null) request.input('limit', mssql.Int, limit)
  const result = await request.query<Record<string, unknown>>(
    `SELECT ${limit != null ? 'TOP (@limit)' : ''}
       o.ID_Order, v.Encomenda_Cli_PHC, v.Cliente, v.Area, v.Tipo, v.Produto, v.Sell_Price,
       v.Total_Reconhecimento, v.Diferenca
     FROM [${ORDERS_SCHEMA}].[V_Orders_Reconhecimento_Pendente] AS v
     OUTER APPLY (
       SELECT TOP 1 oo.ID_Order
       FROM [${ORDERS_SCHEMA}].[${ORDERS_TABLE}] AS oo
       WHERE oo.Encomenda_Cli_PHC = v.Encomenda_Cli_PHC
       ORDER BY oo.DT_Order DESC, oo.ID_Order DESC
     ) AS o
     ORDER BY v.Diferenca DESC`,
  )
  return result.recordset.map((row) => ({
    idOrder: numberOrNull(row.ID_Order),
    encomendaCliPHC: stringOrNull(row.Encomenda_Cli_PHC),
    client: stringOrNull(row.Cliente),
    area: stringOrNull(row.Area),
    type: stringOrNull(row.Tipo),
    product: stringOrNull(row.Produto),
    sellPrice: numberOrNull(row.Sell_Price),
    totalRecognition: numberOrNull(row.Total_Reconhecimento),
    difference: numberOrNull(row.Diferenca),
  }))
}

/** Total row count of `V_Orders_Reconhecimento_Pendente` so the dashboard
 * can render "showing N out of M" — the data fetch above caps at TOP 10. */
export async function fetchPendingRecognitionCount(pool: ConnectionPool): Promise<number> {
  const result = await pool.request().query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM [${ORDERS_SCHEMA}].[V_Orders_Reconhecimento_Pendente]`,
  )
  return result.recordset[0]?.c ?? 0
}

export async function fetchRecognitionQueue(
  pool: ConnectionPool,
): Promise<DashboardSnapshotRow['recognitionQueue']> {
  const result = await pool.request().query<Record<string, unknown>>(
    `SELECT
       o.ID_Order,
       v.[Enc PHC] AS encPhc,
       v.[Data Pedido] AS orderDate,
       v.[Cliente] AS client,
       v.[Area] AS area,
       v.[Produto] AS product,
       v.[Tipo] AS type,
       v.[Preço de Venda] AS sellPrice,
       v.[Valor Reconhecido] AS recognizedValue,
       v.[Valor por Reconhecer] AS remainingValue,
       v.[Facturado] AS invoiced
     FROM [${ORDERS_SCHEMA}].[${RECOGNITION_BACKLOG_VIEW}] AS v
     OUTER APPLY (
       SELECT TOP 1 oo.ID_Order
       FROM [${ORDERS_SCHEMA}].[${ORDERS_TABLE}] AS oo
       WHERE oo.Encomenda_Cli_PHC = v.[Enc PHC]
       ORDER BY oo.DT_Order DESC, oo.ID_Order DESC
     ) AS o
     WHERE COALESCE(v.[Valor por Reconhecer], 0) > 0
     ORDER BY v.[Data Pedido] DESC, v.[Valor por Reconhecer] DESC`,
  )
  return result.recordset.map(toDashboardRecognitionQueueRow)
}

export async function fetchNotFullyInvoiced(
  pool: ConnectionPool,
  limit?: number,
): Promise<InvoicingPendingRow[]> {
  const request = pool.request()
  if (limit != null) request.input('limit', mssql.Int, limit)
  const result = await request.query<Record<string, unknown>>(
    `SELECT ${limit != null ? 'TOP (@limit)' : ''}
       v.ID_Order, v.Encomenda_Cli_PHC, c.nome AS Client_Name,
       a.Area, t.Tipo, v.Sell_Price, v.Total_Faturado, v.Diferenca
     FROM [${ORDERS_SCHEMA}].[V_Orders_Nao_Faturadas_Totalmente] AS v
     LEFT JOIN [${ORDERS_SCHEMA}].[${ORDERS_TABLE}] AS o ON o.ID_Order = v.ID_Order
     LEFT JOIN [${ORDERS_SCHEMA}].[Client] AS c ON c.ID_Cliente = o.ID_Client
     LEFT JOIN [${ORDERS_SCHEMA}].[Area] AS a ON a.ID_Area = o.ID_Area
     LEFT JOIN [${ORDERS_SCHEMA}].[Tipo] AS t ON t.ID_Tipo = o.ID_Tipo
     ORDER BY v.Diferenca DESC, v.ID_Order DESC`,
  )
  return result.recordset.map((row) => ({
    idOrder: numberOrNull(row.ID_Order) ?? 0,
    encomendaCliPHC: stringOrNull(row.Encomenda_Cli_PHC),
    client: stringOrNull(row.Client_Name),
    area: stringOrNull(row.Area),
    type: stringOrNull(row.Tipo),
    sellPrice: numberOrNull(row.Sell_Price),
    totalFaturado: numberOrNull(row.Total_Faturado) ?? 0,
    diferenca: numberOrNull(row.Diferenca),
  }))
}

/** Total row count for the not-fully-invoiced source view. The detail fetch
 * caps at TOP N, so the dashboard needs a separate COUNT(*) to render
 * "showing N out of M" on the mini-table accordion. */
export async function fetchNotFullyInvoicedCount(pool: ConnectionPool): Promise<number> {
  const result = await pool.request().query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM [${ORDERS_SCHEMA}].[V_Orders_Nao_Faturadas_Totalmente]`,
  )
  return result.recordset[0]?.c ?? 0
}

export async function fetchWarrantyMissing(
  pool: ConnectionPool,
  limit?: number,
): Promise<DashboardWarrantyMissingRow[]> {
  const request = pool.request()
  if (limit != null) request.input('limit', mssql.Int, limit)
  const result = await request.query<Record<string, unknown>>(
    `SELECT ${limit != null ? 'TOP (@limit)' : ''}
       v.ID_Order, v.Encomenda_Cli_PHC, c.nome AS Client_Name,
       a.Area, t.Tipo, v.ID_Tipo, v.Warranty, v.Warranty_DT_Inicio, v.Sell_Price,
       o.ID_Tp_Warranty, tw.N_Anos
     FROM [${ORDERS_SCHEMA}].[V_Orders_Warranty_Sem_Data] AS v
     LEFT JOIN [${ORDERS_SCHEMA}].[${ORDERS_TABLE}] AS o ON o.ID_Order = v.ID_Order
     LEFT JOIN [${ORDERS_SCHEMA}].[Client] AS c ON c.ID_Cliente = o.ID_Client
     LEFT JOIN [${ORDERS_SCHEMA}].[Area] AS a ON a.ID_Area = o.ID_Area
     LEFT JOIN [${ORDERS_SCHEMA}].[Tipo] AS t ON t.ID_Tipo = o.ID_Tipo
     LEFT JOIN [${ORDERS_SCHEMA}].[Tp_Warranty] AS tw ON tw.ID_Tp_Warranty = o.ID_Tp_Warranty
     ORDER BY v.ID_Order DESC`,
  )
  return result.recordset.map((row) => ({
    idOrder: numberOrNull(row.ID_Order) ?? 0,
    encomendaCliPHC: stringOrNull(row.Encomenda_Cli_PHC),
    client: stringOrNull(row.Client_Name),
    area: stringOrNull(row.Area),
    type: stringOrNull(row.Tipo),
    idTipo: stringOrNull(row.ID_Tipo),
    warranty: booleanOrNull(row.Warranty),
    warrantyDtInicio: dateTimeOrNull(row.Warranty_DT_Inicio),
    sellPrice: numberOrNull(row.Sell_Price),
    idTpWarranty: numberOrNull(row.ID_Tp_Warranty),
    warrantyYears: numberOrNull(row.N_Anos),
  }))
}

/** Total row count for the warranty-missing source view. The detail fetch
 * caps at TOP N, so the dashboard needs a separate COUNT(*) to render
 * "showing N out of M" on the mini-table accordion. */
export async function fetchWarrantyMissingCount(pool: ConnectionPool): Promise<number> {
  const result = await pool.request().query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM [${ORDERS_SCHEMA}].[V_Orders_Warranty_Sem_Data]`,
  )
  return result.recordset[0]?.c ?? 0
}

async function fetchDashboardOrderTypeQueues(
  pool: ConnectionPool,
): Promise<Pick<
  DashboardSnapshotRow,
  'waitingPoOrders' | 'introduzirSapOrders' | 'waitingPoOrdersTotal' | 'introduzirSapOrdersTotal'
>> {
  const result = await pool.request().query<Record<string, unknown>>(
    `SELECT o.ID_Order, o.ID_Tp_Order, o.Encomenda_Cli_PHC, c.nome AS Client_Name
     FROM [${ORDERS_SCHEMA}].[${ORDERS_TABLE}] AS o
     LEFT JOIN [${ORDERS_SCHEMA}].[Client] AS c ON c.ID_Cliente = o.ID_Client
     WHERE o.ID_Tp_Order IN ('WPO', 'SAP')
     ORDER BY o.ID_Order DESC`,
  )
  const rows = result.recordset.map((row) => ({
    orderType: stringOrNull(row.ID_Tp_Order),
    idOrder: numberOrNull(row.ID_Order) ?? 0,
    encomendaCliPHC: stringOrNull(row.Encomenda_Cli_PHC),
    client: stringOrNull(row.Client_Name),
  }))
  const waitingPo = rows.filter((row) => row.orderType === 'WPO')
  const introduzirSap = rows.filter((row) => row.orderType === 'SAP')
  return {
    waitingPoOrders: waitingPo.slice(0, 10),
    introduzirSapOrders: introduzirSap.slice(0, 10),
    waitingPoOrdersTotal: waitingPo.length,
    introduzirSapOrdersTotal: introduzirSap.length,
  }
}

/**
 * Zero-fills the trend chart with exactly {@link TREND_WINDOW} months ending
 * at the current month. The window rolls forward automatically — in January
 * it includes July–December of the previous year, in February August–December
 * + January, and so on, so the chart never collapses to a single bar.
 */
function buildDashboardTrend(
  rows: Record<string, unknown>[],
  windowStart: Date,
): DashboardSnapshotRow['monthlyTrend'] {
  const start = firstUtcMonth(windowStart)
  const byKey = new Map<string, Record<string, unknown>>()
  for (const row of rows) {
    const y = numberOrNull(row.month_year)
    const m = numberOrNull(row.month_num)
    if (y == null || m == null) continue
    byKey.set(`${y}-${m}`, row)
  }
  return Array.from({ length: TREND_WINDOW }, (_, index) => {
    const monthDate = addUtcMonths(start, index)
    const yearValue = monthDate.getUTCFullYear()
    const monthValue = monthDate.getUTCMonth() + 1
    const row = byKey.get(`${yearValue}-${monthValue}`)
    return {
      monthStart: monthDate.toISOString(),
      revenue: numberOrNull(row?.revenue) ?? 0,
      nob: numberOrNull(row?.nob) ?? 0,
    }
  })
}

function toDashboardRecognitionQueueRow(
  row: Record<string, unknown>,
): DashboardRecognitionQueueRow {
  return {
    idOrder: numberOrNull(row.ID_Order),
    encPhc: stringOrNull(row.encPhc),
    orderDate: dateTimeOrNull(row.orderDate),
    client: stringOrNull(row.client),
    area: stringOrNull(row.area),
    product: stringOrNull(row.product),
    type: stringOrNull(row.type),
    sellPrice: numberOrNull(row.sellPrice),
    recognizedValue: numberOrNull(row.recognizedValue),
    remainingValue: numberOrNull(row.remainingValue),
    invoiced: booleanOrNull(row.invoiced),
  }
}
