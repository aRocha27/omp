/**
 * HTTP Orders repository.
 *
 * Live implementation of `OrdersRepository` backed by the Node API orders endpoints
 * (`POST /orders/list`, `GET /orders?id=N`). The contract carries no credentials —
 * the backend reads through a server-configured managed profile, so the browser never
 * sends a password (or an admin token). Failures are mapped to `RepositoryError` so
 * the UI's existing error states render unchanged.
 */
import type { Order, OrderFacets, OrderSearchFilters, OrderSummary } from '@/domain/models/order'
import { normaliseOrderFilters } from '@/domain/models/order'
import type { RoleLike } from '@/domain/models/user'
import {
  type OrderSearchPage,
  type OrderPage,
  type OrderPageRequest,
  type OrderUpdatePatch,
  type OrderCreateInput,
  type OrdersRepository,
} from '@/services/contracts/orders.repository'
import { getJson, postJson, unwrapApiFailure, type ApiFailure } from '@/services/http/_shared'

type SummaryRow = Omit<OrderSummary, never>
type DetailRow = Omit<Order, 'upsize_ts'> & { Client_Name?: string | null }

interface OkOrdersResponse {
  ok: true
  orders: SummaryRow[]
}
interface OkOrderResponse {
  ok: true
  order: DetailRow | null
}
interface OkUpdateResponse {
  ok: true
  order: DetailRow
}
interface OkCreateResponse {
  ok: true
  order: DetailRow
}

const ORDERS_FORBIDDEN_CODES = new Set(['unauthorized', 'forbidden', 'field-locked'])
const ORDERS_FETCH_OPTIONS = { forbiddenCodes: ORDERS_FORBIDDEN_CODES }

export class HttpOrdersRepository implements OrdersRepository {
  async search(filters: OrderSearchFilters, page?: OrderSearchPage): Promise<OrderSummary[]> {
    const body = {
      filters: normaliseOrderFilters(filters),
      ...(page ? { limit: page.limit, offset: page.offset } : {}),
    }
    const data = await postJson<OkOrdersResponse | ApiFailure>(
      '/orders/list',
      body,
      undefined,
      ORDERS_FETCH_OPTIONS,
    )
    return unwrapApiFailure(data).orders.map(toOrderSummary)
  }

  async searchPage(filters: OrderSearchFilters, page: OrderPageRequest): Promise<OrderPage> {
    const data = await postJson<({ ok: true } & OrderPage) | ApiFailure>(
      '/orders/page',
      { filters: normaliseOrderFilters(filters), ...page },
      undefined,
      ORDERS_FETCH_OPTIONS,
    )
    const result = unwrapApiFailure(data)
    return {
      items: result.items.map(toOrderSummary),
      nextCursor: result.nextCursor,
      total: result.total,
    }
  }

  async getById(id: number): Promise<Order | null> {
    const data = await getJson<OkOrderResponse | ApiFailure>(
      `/orders?id=${id}`,
      ORDERS_FETCH_OPTIONS,
    )
    const ok = unwrapApiFailure(data)
    return ok.order === null ? null : toOrder(ok.order)
  }

  async facets(filters: OrderSearchFilters): Promise<OrderFacets> {
    const data = await postJson<{ ok: true; facets: OrderFacets } | ApiFailure>(
      '/orders/facets',
      { filters: normaliseOrderFilters(filters) },
      undefined,
      ORDERS_FETCH_OPTIONS,
    )
    return unwrapApiFailure(data).facets
  }

  async update(id: number, patch: OrderUpdatePatch, role: RoleLike): Promise<Order> {
    const data = await postJson<OkUpdateResponse | ApiFailure>(
      '/orders/update',
      { id, patch },
      role,
      ORDERS_FETCH_OPTIONS,
    )
    return toOrder(unwrapApiFailure(data).order)
  }

  async create(input: OrderCreateInput, role: RoleLike): Promise<Order> {
    const data = await postJson<OkCreateResponse | ApiFailure>(
      '/orders',
      { ...input },
      role,
      ORDERS_FETCH_OPTIONS,
    )
    return toOrder(unwrapApiFailure(data).order)
  }

  async updateWarrantyYears(id: number, years: number, role: RoleLike): Promise<boolean> {
    const data = await postJson<{ ok: true } | ApiFailure>(
      '/orders/warranty-years',
      { id, years },
      role,
      ORDERS_FETCH_OPTIONS,
    )
    return unwrapApiFailure(data).ok
  }

  async appendAudit(id: number, entry: string, role: RoleLike): Promise<void> {
    const data = await postJson<{ ok: true } | ApiFailure>(
      '/orders/audit',
      { id, entry },
      role,
      ORDERS_FETCH_OPTIONS,
    )
    unwrapApiFailure(data)
  }
}

function toOrderSummary(row: SummaryRow): OrderSummary {
  return {
    ID_Order: row.ID_Order,
    DT_Order: row.DT_Order,
    Order_Factory: row.Order_Factory,
    ID_Tp_Order: row.ID_Tp_Order,
    Provisoria: row.Provisoria,
    ID_Client: row.ID_Client,
    Client_Name: row.Client_Name,
    ID_Area: row.ID_Area,
    ID_Tipo: row.ID_Tipo,
    ID_Produto: row.ID_Produto,
    ID_Instrumento: row.ID_Instrumento,
    Tp_Order_Label: row.Tp_Order_Label,
    Area_Label: row.Area_Label,
    Tipo_Label: row.Tipo_Label,
    Produto_Label: row.Produto_Label,
    Instrumento_Label: row.Instrumento_Label,
    Tp_Warranty_Label: row.Tp_Warranty_Label,
    Tp_Revenue_Label: row.Tp_Revenue_Label,
    Sell_Price: row.Sell_Price,
    Negocio_Fechado: row.Negocio_Fechado,
    Encomenda_Cli_PHC: row.Encomenda_Cli_PHC,
    Kit: row.Kit,
    ID_Tp_Warranty: row.ID_Tp_Warranty,
    Warranty_Reserve: row.Warranty_Reserve,
    Warranty_DT_Inicio: row.Warranty_DT_Inicio,
    Orc_Proposta: row.Orc_Proposta,
    PO_Cliente: row.PO_Cliente,
    ID_Tp_Revenue: row.ID_Tp_Revenue,
  }
}

function toOrder(row: DetailRow): Order {
  return {
    ID_Order: row.ID_Order,
    DT_Order: row.DT_Order,
    Order_Factory: row.Order_Factory,
    ID_Tp_Order: row.ID_Tp_Order,
    Provisoria: row.Provisoria,
    Encomenda_Cli_PHC: row.Encomenda_Cli_PHC,
    ID_Client: row.ID_Client,
    // The live detail endpoint returns Client_Name from the Client join; the mock
    // leaves it unset. The detail page prefers `order.Client_Name` and falls back
    // to `resolveClientName(ID_Client)`.
    Client_Name: row.Client_Name ?? null,
    ID_Area: row.ID_Area,
    ID_Tipo: row.ID_Tipo,
    Tipo_Warranty: row.Tipo_Warranty ?? null,
    ID_Produto: row.ID_Produto,
    ID_Instrumento: row.ID_Instrumento,
    Tp_Order_Label: row.Tp_Order_Label,
    Area_Label: row.Area_Label,
    Tipo_Label: row.Tipo_Label,
    Produto_Label: row.Produto_Label,
    Instrumento_Label: row.Instrumento_Label,
    Tp_Warranty_Label: row.Tp_Warranty_Label,
    Tp_Revenue_Label: row.Tp_Revenue_Label,
    Orc_Proposta: row.Orc_Proposta,
    PO_Cliente: row.PO_Cliente,
    Sell_Price: row.Sell_Price,
    ID_Tp_Warranty: row.ID_Tp_Warranty,
    Warranty_Reserve: row.Warranty_Reserve,
    Warranty_DT_Inicio: row.Warranty_DT_Inicio,
    ID_Tp_Revenue: row.ID_Tp_Revenue,
    Facturado: row.Facturado,
    Reconhecido: row.Reconhecido,
    Cod_Enc_Fornecedor: row.Cod_Enc_Fornecedor,
    Obs: row.Obs,
    Negocio_Fechado: row.Negocio_Fechado,
    ID_User: row.ID_User,
    DT_User: row.DT_User,
    // upsize_ts is stripped by the backend; contact fields are projected from dbo.[Order].
    upsize_ts: null,
    Kit: row.Kit,
    Kit_Amount: row.Kit_Amount,
    Contacto: row.Contacto,
    Email: row.Email,
    Audit: row.Audit ?? null,
  }
}
