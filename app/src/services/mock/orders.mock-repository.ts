/**
 * Mock Orders repository.
 *
 * Deterministic, in-memory implementation of `OrdersRepository` backed by
 * synthetic fixtures. May simulate latency but must not invent business rules
 * (docs/architecture/ARCHITECTURE.md §4, MOCK_DATA_CONTRACT.md §5).
 */
import type { Order, OrderSearchFilters, OrderSummary } from '@/domain/models/order'
import { normaliseOrderFilters } from '@/domain/models/order'
import type { Role } from '@/domain/models/user'
import { RepositoryError, type OrderCreateInput, type OrderUpdatePatch, type OrdersRepository } from '@/services/contracts/orders.repository'
import { resolveClientName, toOrderSummary } from '@/fixtures/orders'
import { resolveTipoWarranty } from '@/fixtures/reference-data'
import { MockDataStore } from '@/services/mock/mock-data-store'
import { assertMockMutationRole } from '@/services/mock/mock-authorization'
import {
  assertExistingInvoicingCapacity,
  assertExistingRecognitionCapacity,
} from '@/services/mock/mock-capacity'

/** Simulated network latency for realistic loading-state behaviour (ms). */
const MOCK_LATENCY_MS = 120

/**
 * Contains match (case-insensitive). When `filter` is set and `field` is
 * null/undefined, the row MUST be excluded (return false) — this is the
 * null-row leak guard for fixture 1006.
 */
function containsMatch(field: string | null | undefined, filter: string): boolean {
  if (field === null || field === undefined) return false
  return field.toLowerCase().includes(filter.toLowerCase())
}

function matches(row: Order, filters: OrderSearchFilters): boolean {
  // Date range (DT_Order is typed non-null; guard defensively anyway).
  if (filters.dateFrom !== null && filters.dateFrom !== undefined) {
    if (!row.DT_Order || row.DT_Order < filters.dateFrom) return false
  }
  if (filters.dateTo !== null && filters.dateTo !== undefined) {
    if (!row.DT_Order || row.DT_Order > filters.dateTo) return false
  }

  // Contains, case-insensitive — null field excludes the row.
  if (filters.clientName !== null && filters.clientName !== undefined) {
    if (!containsMatch(resolveClientName(row.ID_Client), filters.clientName)) return false
  }
  if (filters.encomendaCliPHC !== null && filters.encomendaCliPHC !== undefined) {
    if (!containsMatch(row.Encomenda_Cli_PHC, filters.encomendaCliPHC)) return false
  }

  // Boolean "only show…" toggles — only `true` is sent (false is stripped). Null field
  // coerces to false so a null row is excluded when the toggle is on.
  if (filters.orderFactory !== null && filters.orderFactory !== undefined) {
    if ((row.Order_Factory ?? false) !== filters.orderFactory) return false
  }
  if (filters.negocioFechado !== null && filters.negocioFechado !== undefined) {
    if ((row.Negocio_Fechado ?? false) !== filters.negocioFechado) return false
  }

  // Categorical multi-select — row matches if its value is in the set. A null field
  // never matches a non-empty set, so null rows (fixture 1006) are excluded.
  if (filters.idTpOrder !== null && filters.idTpOrder !== undefined) {
    if (row.ID_Tp_Order === null || !filters.idTpOrder.includes(row.ID_Tp_Order)) return false
  }
  if (filters.idArea !== null && filters.idArea !== undefined) {
    if (row.ID_Area === null || !filters.idArea.includes(row.ID_Area)) return false
  }
  if (filters.idTipo !== null && filters.idTipo !== undefined) {
    if (row.ID_Tipo === null || !filters.idTipo.includes(row.ID_Tipo)) return false
  }
  if (filters.idProduto !== null && filters.idProduto !== undefined) {
    if (row.ID_Produto === null || !filters.idProduto.includes(row.ID_Produto)) return false
  }
  if (filters.idInstrumento !== null && filters.idInstrumento !== undefined) {
    if (row.ID_Instrumento === null || !filters.idInstrumento.includes(row.ID_Instrumento)) {
      return false
    }
  }

  return true
}

export class MockOrdersRepository implements OrdersRepository {
  private readonly rows: Order[]

  constructor(private readonly store: MockDataStore = new MockDataStore()) {
    this.rows = store.orders
  }

  async search(filters: OrderSearchFilters): Promise<OrderSummary[]> {
    const active = normaliseOrderFilters(filters)
    await delay(MOCK_LATENCY_MS)
    return this.rows
      .filter((row) => matches(row, active))
      .sort((a, b) => {
        // Confirmed ordering: DT_Order DESC, then ID_Order DESC (AGENT.md §9).
        if (a.DT_Order !== b.DT_Order) return a.DT_Order < b.DT_Order ? 1 : -1
        return a.ID_Order < b.ID_Order ? 1 : -1
      })
      .map(toOrderSummary)
  }

  async getById(id: number): Promise<Order | null> {
    await delay(MOCK_LATENCY_MS)
    return this.rows.find((row) => row.ID_Order === id) ?? null
  }

  async update(id: number, patch: OrderUpdatePatch, role: Role): Promise<Order> {
    await delay(MOCK_LATENCY_MS)
    assertMockMutationRole(role, 'Sem permissão para alterar pedidos.')
    // Mutate the per-instance copy so the next `getById` is consistent with the
    // edit, mirroring how the live DB persists the change — without touching the
    // shared fixture (which would pollute other test renders).
    const current = this.rows.find((row) => row.ID_Order === id)
    if (!current) {
      throw new RepositoryError('not-found', 'Order not found.')
    }
    const candidate: Order = { ...current, ...patch }
    if ('ID_Tipo' in patch) {
      candidate.Tipo_Warranty = resolveTipoWarranty(candidate.ID_Tipo)
    }

    if (
      'Sell_Price' in patch ||
      'Warranty_Reserve' in patch ||
      'ID_Tipo' in patch
    ) {
      assertExistingRecognitionCapacity(
        candidate,
        this.store.reconhecimentos.filter((row) => row.ID_Order === id),
      )
      assertExistingInvoicingCapacity(
        candidate,
        this.store.facturacao.filter((row) => row.ID_Order === id),
      )
    }

    Object.assign(current, candidate)
    return { ...current }
  }

  async create(input: OrderCreateInput, role: Role): Promise<Order> {
    await delay(MOCK_LATENCY_MS)
    assertMockMutationRole(role, 'Sem permissão para criar pedidos.')
    const order: Order = {
      ID_Order: Math.max(...this.rows.map((row) => row.ID_Order), 0) + 1,
      DT_Order: input.DT_Order ?? new Date().toISOString(),
      Order_Factory: false,
      ID_Tp_Order: input.ID_Tp_Order ?? 'C',
      Provisoria: false,
      Encomenda_Cli_PHC: input.Encomenda_Cli_PHC ?? null,
      ID_Client: input.ID_Client ?? null,
      ID_Area: input.ID_Area ?? null,
      ID_Tipo: input.ID_Tipo ?? null,
      Tipo_Warranty: resolveTipoWarranty(input.ID_Tipo ?? null),
      ID_Produto: input.ID_Produto ?? null,
      ID_Instrumento: input.ID_Instrumento ?? null,
      Orc_Proposta: input.Orc_Proposta ?? null,
      PO_Cliente: input.PO_Cliente ?? null,
      Sell_Price: input.Sell_Price ?? null,
      ID_Tp_Warranty: input.ID_Tp_Warranty ?? null,
      Warranty_Reserve: input.Warranty_Reserve ?? null,
      Warranty_DT_Inicio: input.Warranty_DT_Inicio ?? null,
      ID_Tp_Revenue: input.ID_Tp_Revenue ?? null,
      Facturado: false,
      Reconhecido: false,
      Cod_Enc_Fornecedor: input.Cod_Enc_Fornecedor ?? null,
      Obs: input.Obs ?? null,
      Negocio_Fechado: false,
      ID_User: null,
      DT_User: null,
      upsize_ts: null,
      Kit: input.Kit ?? false,
      Kit_Amount: input.Kit_Amount ?? null,
      Contacto: null,
      Email: null,
    }
    this.rows.push(order)
    return { ...order }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
