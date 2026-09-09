import type { WarrantyMissingItem } from '@/domain/models/dashboard'
import type { DashboardPendingRecognitionItem } from '@/domain/models/dashboard'

export interface NotFullyInvoicedItem {
  idOrder: number
  encomendaCliPHC: string | null
  client: string | null
  area: string | null
  type: string | null
  sellPrice: number | null
  totalFaturado: number
  diferenca: number | null
}

export interface InvoicingSnapshot {
  amountToInvoice: number
  notFullyInvoiced: NotFullyInvoicedItem[]
  warrantyMissing: WarrantyMissingItem[]
  pendingRecognition?: DashboardPendingRecognitionItem[]
  pendingRecognitionTotal?: number
}
