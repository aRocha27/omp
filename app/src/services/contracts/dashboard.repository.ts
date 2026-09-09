import type { DashboardRecognitionQueueItem, DashboardSnapshot } from '@/domain/models/dashboard'
import { RepositoryError } from './orders.repository'

export interface DashboardRepository {
  getSnapshot(): Promise<DashboardSnapshot>
  /** Full backlog of orders that still have positive remaining value to recognize,
   *  sourced from dbo.[11-Reconhecimento-PorReconhecer]. Same row shape as the queue
   *  rows inside `DashboardSnapshot`; exposed separately so the dashboard's "View all"
   *  modal can render the complete view without re-fetching the snapshot. */
  getRecognitionQueue(): Promise<DashboardRecognitionQueueItem[]>
}

export { RepositoryError }
