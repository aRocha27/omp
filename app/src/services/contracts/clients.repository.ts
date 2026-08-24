/**
 * Clients repository contract.
 *
 * UI code depends on this interface, never on the concrete HTTP implementation.
 * Clients are HTTP-only (no mock) — the user explicitly wants no fictitious client
 * data, so there is no `MockClientsRepository`. Tests stub the global `fetch`.
 *
 * `RepositoryError` is re-exported from the orders contract so there's a single
 * shared error type across the app.
 */
import type { Client, ClientSearchFilters, ClientSummary } from '@/domain/models/client'

export interface ClientsRepository {
  /**
   * Search clients by confirmed filters.
   * Results are ordered by `nome` ascending (the backend default).
   */
  search(filters: ClientSearchFilters): Promise<ClientSummary[]>

  /**
   * Fetch a single client by its `ID_Cliente`.
   * Returns `null` when no client matches — callers handle the not-found case
   * (no throw on not-found).
   */
  getById(id: number): Promise<Client | null>
}

export { RepositoryError } from './orders.repository'