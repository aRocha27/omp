/**
 * Mock Orders repository.
 *
 * Deterministic, in-memory implementation of `OrdersRepository` backed by
 * synthetic fixtures. May simulate latency but must not invent business rules
 * (docs/architecture/ARCHITECTURE.md §4, MOCK_DATA_CONTRACT.md §5).
 */
import type { OrderSearchFilters, OrderSummary } from '@/domain/models/order'
import { normaliseOrderFilters } from '@/domain/models/order'
import type { OrdersRepository } from '@/services/contracts/orders.repository'
import { orderSummaries } from '@/fixtures/orders'

/** Simulated network latency for realistic loading-state behaviour (ms). */
const MOCK_LATENCY_MS = 120

function matches(row: OrderSummary, filters: OrderSearchFilters): boolean {
  if (filters.dateFrom !== null && filters.dateFrom !== undefined && row.DT_Order < filters.dateFrom) {
    return false
  }
  if (filters.dateTo !== null && filters.dateTo !== undefined && row.DT_Order > filters.dateTo) {
    return false
  }
  if (
    filters.clientName !== null &&
    filters.clientName !== undefined &&
    row.Client_Name !== null &&
    !row.Client_Name.toLowerCase().includes(filters.clientName.toLowerCase())
  ) {
    return false
  }
  if (filters.orderFactory !== null && filters.orderFactory !== undefined) {
    // Treat null factory flags as "not a factory order" for the boolean filter.
    if ((row.Order_Factory ?? false) !== filters.orderFactory) return false
  }
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
  if (
    filters.encomendaCliPHC !== null &&
    filters.encomendaCliPHC !== undefined &&
    row.Encomenda_Cli_PHC !== filters.encomendaCliPHC
  ) {
    return false
  }
  if (filters.negocioFechado !== null && filters.negocioFechado !== undefined) {
    if ((row.Negocio_Fechado ?? false) !== filters.negocioFechado) return false
  }
  return true
}

export class MockOrdersRepository implements OrdersRepository {
  async search(filters: OrderSearchFilters): Promise<OrderSummary[]> {
    const active = normaliseOrderFilters(filters)
    await delay(MOCK_LATENCY_MS)
    return orderSummaries
      .filter((row) => matches(row, active))
      .sort((a, b) => {
        // Confirmed ordering: DT_Order DESC, then ID_Order DESC (AGENT.md §9).
        if (a.DT_Order !== b.DT_Order) return a.DT_Order < b.DT_Order ? 1 : -1
        return a.ID_Order < b.ID_Order ? 1 : -1
      })
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}