import type { InvoicingSnapshot } from '@/domain/models/invoicing'
import { RepositoryError } from './orders.repository'

export interface InvoicingRepository {
  getSnapshot(): Promise<InvoicingSnapshot>
}

export { RepositoryError }
