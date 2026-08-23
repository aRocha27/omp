/**
 * Repository contracts.
 *
 * UI code depends on these interfaces, never on a concrete mock/HTTP
 * implementation. `Mock*Repository` is used now; `Http*Repository` replaces it
 * during the integration phase without UI changes.
 * See docs/architecture/ARCHITECTURE.md §3 and INTEGRATION_PLAN.md.
 */
import type { Order, OrderSearchFilters, OrderSummary } from '@/domain/models/order'

/**
 * Read path for the Orders list and detail.
 *
 * `search` backs the list slice; `getById` backs the detail slice.
 * `create` / `update` are added when the write path lands.
 */
export interface OrdersRepository {
  /**
   * Search orders by confirmed filters.
   * Results are ordered `DT_Order DESC, ID_Order DESC` (AGENT.md §9).
   */
  search(filters: OrderSearchFilters): Promise<OrderSummary[]>

  /**
   * Fetch a single order by its `ID_Order`.
   * Returns `null` when no order matches — callers handle the not-found case
   * (no throw on not-found).
   */
  getById(id: number): Promise<Order | null>
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