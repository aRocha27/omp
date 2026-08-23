/**
 * Mock Orders repository.
 *
 * Deterministic, in-memory implementation of `OrdersRepository` backed by
 * synthetic fixtures. May simulate latency but must not invent business rules
 * (docs/architecture/ARCHITECTURE.md §4, MOCK_DATA_CONTRACT.md §5).
 */
import type { Order, OrderSearchFilters, OrderSummary } from '@/domain/models/order'
import { normaliseOrderFilters } from '@/domain/models/order'
import type { OrdersRepository } from '@/services/contracts/orders.repository'
import { orders, resolveClientName, toOrderSummary } from '@/fixtures/orders'

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

  // Boolean filters — null treated as false.
  if (filters.orderFactory !== null && filters.orderFactory !== undefined) {
    if ((row.Order_Factory ?? false) !== filters.orderFactory) return false
  }
  if (filters.negocioFechado !== null && filters.negocioFechado !== undefined) {
    if ((row.Negocio_Fechado ?? false) !== filters.negocioFechado) return false
  }

  // Identity filters — null !== value already excludes null rows.
  if (filters.idTpOrder !== null && filters.idTpOrder !== undefined && row.ID_Tp_Order !== filters.idTpOrder) {
    return false
  }
  if (filters.idArea !== null && filters.idArea !== undefined && row.ID_Area !== filters.idArea) {
    return false
  }
  if (filters.idTipo !== null && filters.idTipo !== undefined && row.ID_Tipo !== filters.idTipo) {
    return false
  }
  if (filters.idProduto !== null && filters.idProduto !== undefined && row.ID_Produto !== filters.idProduto) {
    return false
  }
  if (
    filters.idInstrumento !== null &&
    filters.idInstrumento !== undefined &&
    row.ID_Instrumento !== filters.idInstrumento
  ) {
    return false
  }

  return true
}

export class MockOrdersRepository implements OrdersRepository {
  async search(filters: OrderSearchFilters): Promise<OrderSummary[]> {
    const active = normaliseOrderFilters(filters)
    await delay(MOCK_LATENCY_MS)
    return orders
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
    return orders.find((row) => row.ID_Order === id) ?? null
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}