/**
 * Repository contracts.
 *
 * UI code depends on these interfaces, never on a concrete mock/HTTP
 * implementation. `Mock*Repository` is used now; `Http*Repository` replaces it
 * during the integration phase without UI changes.
 * See docs/architecture/ARCHITECTURE.md §3 and INTEGRATION_PLAN.md.
 */
import type {
  Order,
  OrderFacets,
  OrderSearchFilters,
  OrderSummary,
  OrderSortId,
} from '@/domain/models/order'
import type { RoleLike } from '@/domain/models/user'

/**
 * Editable subset of `Order` for the write path. Field names preserve the
 * legacy identifiers verbatim (AGENT.md §10) — the wire contract is already
 * snake_case-free, so the patch is sent as-is (no case conversion).
 */
export type OrderUpdatePatch = Partial<
  Pick<
    Order,
    | 'DT_Order'
    | 'Order_Factory'
    | 'ID_Tp_Order'
    | 'Encomenda_Cli_PHC'
    | 'ID_Client'
    | 'ID_Area'
    | 'ID_Tipo'
    | 'ID_Produto'
    | 'ID_Instrumento'
    | 'Orc_Proposta'
    | 'PO_Cliente'
    | 'Email'
    | 'Contacto'
    | 'Sell_Price'
    | 'ID_Tp_Warranty'
    | 'Warranty_Reserve'
    | 'Warranty_DT_Inicio'
    | 'ID_Tp_Revenue'
    | 'Facturado'
    | 'Reconhecido'
    | 'Cod_Enc_Fornecedor'
    | 'Obs'
    | 'Negocio_Fechado'
    | 'Kit'
    | 'Kit_Amount'
  >
>

export type OrderCreateInput = Pick<
  OrderUpdatePatch,
  | 'DT_Order'
  | 'ID_Tp_Order'
  | 'Encomenda_Cli_PHC'
  | 'ID_Client'
  | 'ID_Area'
  | 'ID_Tipo'
  | 'ID_Produto'
  | 'ID_Instrumento'
  | 'Orc_Proposta'
  | 'PO_Cliente'
  | 'Sell_Price'
  | 'ID_Tp_Warranty'
  | 'Warranty_Reserve'
  | 'Warranty_DT_Inicio'
  | 'ID_Tp_Revenue'
  | 'Cod_Enc_Fornecedor'
  | 'Obs'
  | 'Kit'
  | 'Kit_Amount'
>

export interface OrderSearchPage {
  limit: number
  offset: number
}

export interface OrderPage {
  items: OrderSummary[]
  nextCursor: string | null
  total: number
}

export interface OrderPageRequest {
  limit: number
  cursor?: string
  offset?: number
  sort: { id: OrderSortId; direction: 'asc' | 'desc' }
}

/**
 * Read/write path for the Orders list and detail.
 *
 * `search` backs the list slice; `getById` backs the detail slice; `update`
 * backs the detail-page edit flow. `role` is forwarded so the live backend can
 * enforce field-level locks (the mock trusts the UI, which already disables
 * locked fields — see domain/orders/order-policy).
 */
export interface OrdersRepository {
  /**
   * Search orders by confirmed filters.
   * Results are ordered `DT_Order DESC, ID_Order DESC` (AGENT.md §9).
   */
  search(filters: OrderSearchFilters, page?: OrderSearchPage): Promise<OrderSummary[]>
  searchPage(filters: OrderSearchFilters, page: OrderPageRequest): Promise<OrderPage>
  facets(filters: OrderSearchFilters): Promise<OrderFacets>

  /**
   * Fetch a single order by its `ID_Order`.
   * Returns `null` when no order matches — callers handle the not-found case
   * (no throw on not-found).
   */
  getById(id: number): Promise<Order | null>

  /**
   * Apply a partial update to an order. Throws `RepositoryError('not-found')`
   * when `id` doesn't match an existing order; the live backend may also throw
   * `RepositoryError('forbidden')` for a field locked against `role`.
   */
  update(id: number, patch: OrderUpdatePatch, role: RoleLike): Promise<Order>
  appendAudit(id: number, entry: string, role: RoleLike): Promise<void>

  create(input: OrderCreateInput, role: RoleLike): Promise<Order>

  /**
   * Patches the warranty-years (`N_Anos`) on `dbo.Tp_Warranty` for the order's
   * matched warranty type. Returns false when the order has no `ID_Tp_Warranty`
   * set; the live backend surfaces this as a 400, the mock resolves to false.
   */
  updateWarrantyYears(id: number, years: number, role: RoleLike): Promise<boolean>
}

/** Shared error type so the UI can distinguish app-level failure states. */
export class RepositoryError extends Error {
  readonly kind: 'not-found' | 'forbidden' | 'server-error'
  readonly status?: number

  constructor(kind: 'not-found' | 'forbidden' | 'server-error', message: string, status?: number) {
    super(message)
    this.name = 'RepositoryError'
    this.kind = kind
    this.status = status
  }
}
