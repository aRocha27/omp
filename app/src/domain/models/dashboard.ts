import type { OrderSummary } from '@/domain/models/order'

export interface DashboardKpis {
  ordersBookedYtd: number
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

export interface DashboardSnapshot {
  year: number
  kpis: DashboardKpis
  monthlyTrend: DashboardTrendPoint[]
  recognitionQueue: DashboardRecognitionQueueItem[]
  recentOrders: OrderSummary[]
}
