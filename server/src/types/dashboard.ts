/**
 * Dashboard + Invoicing wire types.
 */

import type { OrderSummaryRow } from './order'

export type DashboardKpisRow = {
  ordersBookedYtd: number
  nobYtd: number
  revenueRecognizedYtd: number
  backlogToRecognize: number
  backlogAtPeriodStart: number
  amountToInvoice: number
}

export type DashboardTrendPointRow = {
  monthStart: string
  revenue: number
  nob: number
}

export type DashboardRecognitionQueueRow = {
  idOrder: number | null
  encPhc: string | null
  orderDate: string | null
  client: string | null
  area: string | null
  product: string | null
  type: string | null
  sellPrice: number | null
  recognizedValue: number | null
  remainingValue: number | null
  invoiced: boolean | null
}

export type DashboardPendingRecognitionRow = {
  idOrder: number | null
  encomendaCliPHC: string | null
  client: string | null
  area: string | null
  type: string | null
  product: string | null
  sellPrice: number | null
  totalRecognition: number | null
  difference: number | null
}

export type DashboardWarrantyMissingRow = {
  idOrder: number
  encomendaCliPHC: string | null
  client: string | null
  area: string | null
  type: string | null
  idTipo: string | null
  warranty: boolean | null
  warrantyDtInicio: string | null
  sellPrice: number | null
  idTpWarranty: number | null
  warrantyYears: number | null
}

export type InvoicingPendingRow = {
  idOrder: number
  encomendaCliPHC: string | null
  client: string | null
  area: string | null
  type: string | null
  sellPrice: number | null
  totalFaturado: number
  diferenca: number | null
}

export type DashboardSnapshotRow = {
  year: number
  kpis: DashboardKpisRow
  monthlyTrend: DashboardTrendPointRow[]
  recognitionQueue: DashboardRecognitionQueueRow[]
  pendingRecognition?: DashboardPendingRecognitionRow[]
  /** Total row count of `V_Orders_Reconhecimento_Pendente` so the dashboard
   * can render "showing N out of M" without a second client-side request. */
  pendingRecognitionTotal?: number
  warrantyMissing: DashboardWarrantyMissingRow[]
  /** Total row count of `V_Orders_Warranty_Sem_Data` so the dashboard
   * can render "showing N out of M" without a second client-side request. */
  warrantyMissingTotal?: number
  notFullyInvoiced: InvoicingPendingRow[]
  /** Total row count of `V_Orders_Nao_Faturadas_Totalmente` so the dashboard
   * can render "showing N out of M" without a second client-side request. */
  notFullyInvoicedTotal?: number
  recentOrders: OrderSummaryRow[]
  waitingPoOrders?: DashboardOrderTypeRow[]
  introduzirSapOrders?: DashboardOrderTypeRow[]
  /** Totals for the Order Type queues so the UI can show
   * "showing N out of M" alongside the TOP10 sample. */
  waitingPoOrdersTotal?: number
  introduzirSapOrdersTotal?: number
}

export type DashboardOrderTypeRow = {
  idOrder: number
  encomendaCliPHC: string | null
  client: string | null
}

export type OkDashboard = {
  ok: true
  dashboard: DashboardSnapshotRow
}

export type OkRecognitionQueue = {
  ok: true
  recognitionQueue: DashboardRecognitionQueueRow[]
}

export type InvoicingSnapshotRow = {
  amountToInvoice: number
  notFullyInvoiced: InvoicingPendingRow[]
  warrantyMissing: DashboardWarrantyMissingRow[]
  pendingRecognition?: DashboardPendingRecognitionRow[]
  pendingRecognitionTotal?: number
}

export type OkInvoicing = {
  ok: true
  invoicing: InvoicingSnapshotRow
}
