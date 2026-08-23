/**
 * Repository contracts.
 *
 * UI code depends on these interfaces, never on a concrete mock/HTTP
 * implementation. `Mock*Repository` is used now; `Http*Repository` replaces it
 * during the integration phase without UI changes.
 * See docs/architecture/ARCHITECTURE.md §3 and INTEGRATION_PLAN.md.
 */
import type { OrderSearchFilters, OrderSummary } from '@/domain/models/order'

/**
 * Read path for the Orders list.
 *
 * The first vertical slice implements `search`. `getById` / `create` / `update`
 * are added when the Order-detail slice lands.
 */
export interface OrdersRepository {
  /**
   * Search orders by confirmed filters.
   * Results are ordered `DT_Order DESC, ID_Order DESC` (AGENT.md §9).
   */
  search(filters: OrderSearchFilters): Promise<OrderSummary[]>
}

/** Shared error type so the UI can distinguish app-level failure states. */
export class RepositoryError extends Error {
  readonly kind: 'not-found' | 'forbidden' | 'server-error'
  readonly status?: number

  constructor(
    kind: 'not-found' | 'forbidden' | 'server-error',
    message: string,
    status?: number,
  ) {
    super(message)
    this.name = 'RepositoryError'
    this.kind = kind
    this.status = status
  }
}