import type { OrderSummary } from '@/domain/models/order'
import type { NotFullyInvoicedItem } from '@/domain/models/invoicing'

export interface DashboardKpis {
  ordersBookedYtd: number
  amountToInvoice: number
  nobYtd: number
  revenueRecognizedYtd: number
  backlogToRecognize: number
  backlogAtPeriodStart: number
}

export interface DashboardTrendPoint {
  monthStart: string
  revenue: number
  nob: number
}

export interface DashboardRecognitionQueueItem {
  /** `dbo.[Order].ID_Order` for the queue row. Lets the dashboard's "View all" modal
   *  link straight to the order detail page; null when the underlying view row is
   *  orphaned (no matching Order). */
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

export interface DashboardPendingRecognitionItem {
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

export interface WarrantyMissingItem {
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

export interface DashboardSnapshot {
  year: number
  kpis: DashboardKpis
  monthlyTrend: DashboardTrendPoint[]
  recognitionQueue: DashboardRecognitionQueueItem[]
  pendingRecognition?: DashboardPendingRecognitionItem[]
  /** Total row count of the source view so the dashboard can render
   * "showing N out of M" alongside the TOP-N sample. Optional so older
   * dashboard payloads (without the count) keep working — the UI falls
   * back to the sample count. */
  pendingRecognitionTotal?: number
  warrantyMissing: WarrantyMissingItem[]
  /** Total row count of `V_Orders_Warranty_Sem_Data` so the
   * "showing N out of M" pill on the Warranty mini-table can be rendered
   * without an extra client-side request. */
  warrantyMissingTotal?: number
  notFullyInvoiced: NotFullyInvoicedItem[]
  /** Total row count of `V_Orders_Nao_Faturadas_Totalmente` so the
   * "showing N out of M" pill on the Invoicing mini-table can be
   * rendered without an extra client-side request. */
  notFullyInvoicedTotal?: number
  recentOrders: OrderSummary[]
  waitingPoOrders?: DashboardOrderTypeItem[]
  introduzirSapOrders?: DashboardOrderTypeItem[]
  /** Totals for the Order Type queues (WPO / SAP). Optional for the same
   * backwards-compat reason as `pendingRecognitionTotal`. */
  waitingPoOrdersTotal?: number
  introduzirSapOrdersTotal?: number
}

export interface DashboardOrderTypeItem {
  idOrder: number
  encomendaCliPHC: string | null
  client: string | null
}
