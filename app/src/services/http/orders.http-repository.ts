/**
 * HTTP Orders repository.
 *
 * Live implementation of `OrdersRepository` backed by the Node API orders endpoints
 * (`POST /orders/list`, `GET /orders?id=N`). The contract carries no credentials —
 * the backend reads through a server-configured managed profile, so the browser never
 * sends a password (or an admin token). Failures are mapped to `RepositoryError` so
 * the UI's existing error states render unchanged.
 */
import { env } from '@/app/configuration/env'
import type { Order, OrderSearchFilters, OrderSummary } from '@/domain/models/order'
import { normaliseOrderFilters } from '@/domain/models/order'
import type { RoleLike } from '@/domain/models/user'
import {
  RepositoryError,
  type OrderUpdatePatch,
  type OrderCreateInput,
  type OrdersRepository,
} from '@/services/contracts/orders.repository'

const LIST_LIMIT = 200

type SummaryRow = Omit<OrderSummary, never>
type DetailRow = Omit<Order, 'Email' | 'upsize_ts'> & { Client_Name?: string | null }

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
interface ApiFailure {
  ok: false
  code: string
  message: string
}

export class HttpOrdersRepository implements OrdersRepository {
  async search(filters: OrderSearchFilters): Promise<OrderSummary[]> {
    const body = { filters: normaliseOrderFilters(filters), limit: LIST_LIMIT }
    const data = await postJson<OkOrdersResponse | ApiFailure>('/orders/list', body)
    if (!data.ok) throw toRepositoryError(data, 502)
    return data.orders.map(toOrderSummary)
  }

  async getById(id: number): Promise<Order | null> {
    const data = await getJson<OkOrderResponse | ApiFailure>(`/orders?id=${id}`)
    if (!data.ok) throw toRepositoryError(data, 404)
    return data.order === null ? null : toOrder(data.order)
  }

  async update(id: number, patch: OrderUpdatePatch, role: RoleLike): Promise<Order> {
    // The wire contract preserves legacy field names verbatim — no case
    // conversion (MOCK_DATA_CONTRACT §5). The role header is only a development
    // identity selector; the update body cannot spoof the audit user.
    const data = await postJson<OkUpdateResponse | ApiFailure>(
      '/orders/update',
      { id, patch },
      { 'X-User-Role': role },
    )
    // Unreachable — `requestJson` throws on non-ok — but narrows the union for TS.
    if (!data.ok) throw toRepositoryError(data, 404)
    return toOrder(data.order)
  }

  async create(input: OrderCreateInput, role: RoleLike): Promise<Order> {
    const data = await postJson<OkCreateResponse | ApiFailure>(
      '/orders',
      { ...input },
      { 'X-User-Role': role },
    )
    if (!data.ok) throw toRepositoryError(data, 400)
    return toOrder(data.order)
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
    Sell_Price: row.Sell_Price,
    Negocio_Fechado: row.Negocio_Fechado,
    Encomenda_Cli_PHC: row.Encomenda_Cli_PHC,
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
    // upsize_ts is stripped by the backend; Email is mock-only (no live column).
    upsize_ts: null,
    Kit: row.Kit,
    Kit_Amount: row.Kit_Amount,
    Contacto: row.Contacto,
    Email: null,
  }
}

function toRepositoryError(failure: ApiFailure, notFoundStatus: number): RepositoryError {
  const message = failure.message || 'The database service returned an error.'
  // Authz/identity failures (401/403) collapse to `forbidden`. The update path
  // surfaces `field-locked` (role-gated field) and `forbidden` codes alongside
  // the legacy `unauthorized`. 404 → not-found; everything else → server-error.
  // The list endpoint never 404s, so `notFoundStatus` is only meaningful for
  // getById/update.
  if (
    failure.code === 'unauthorized' ||
    failure.code === 'forbidden' ||
    failure.code === 'field-locked'
  ) {
    return new RepositoryError('forbidden', message)
  }
  if (notFoundStatus === 404) return new RepositoryError('not-found', message)
  return new RepositoryError('server-error', message)
}

async function getJson<T>(path: string): Promise<T> {
  return requestJson<T>(path, { method: 'GET' })
}

async function postJson<T>(path: string, body: unknown, extraHeaders?: Record<string, string>): Promise<T> {
  return requestJson<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  })
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(apiUrl(path), init)
  } catch {
    throw new RepositoryError('server-error', "Couldn't reach the database service.")
  }

  const data = (await response.json().catch(() => null)) as T | ApiFailure | null
  if (!response.ok) {
    const failure = isApiFailure(data)
      ? data
      : { ok: false as const, code: 'unknown', message: 'The database service returned an unexpected error.' }
    throw toRepositoryError(failure, response.status)
  }
  return data as T
}

function isApiFailure(value: unknown): value is ApiFailure {
  if (typeof value !== 'object' || value === null) return false
  return (value as ApiFailure).ok === false
}

function apiUrl(path: string): string {
  return `${env.apiBaseUrl.replace(/\/$/, '')}${path}`
}
