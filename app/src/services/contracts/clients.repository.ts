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
import type { RoleLike } from '@/domain/models/user'

/**
 * Editable subset of `Client` for the write path. Field names preserve the
 * legacy identifiers verbatim (matching the Orders convention) so the wire
 * contract is already snake_case-free. `ID_Cliente` is intentionally absent —
 * it's the primary key and never changes. Optional fields are nullable so a
 * partial patch can clear values as well as set them.
 */
export type ClientUpdatePatch = Partial<
  Pick<
    Client,
    | 'no_PHC'
    | 'ID_Tp_Cliente'
    | 'nome'
    | 'ncont'
    | 'fax'
    | 'telefone'
    | 'contacto'
    | 'morada'
    | 'local'
    | 'codpost'
    | 'zona'
    | 'Defense'
  >
>

/**
 * What the create form submits. The seven user-required fields are non-null
 * (Name, Address, Location, Postal Code, SAP, Tax, Type); the rest are
 * optional so an admin can flesh the record out later via the edit flow.
 */
export type ClientCreateInput = {
  nome: string
  morada: string
  local: string
  codpost: string
  no_PHC: number
  ncont: string
  ID_Tp_Cliente: number
  telefone?: string | null
  contacto?: string | null
  fax?: string | null
  zona?: string | null
  Defense?: boolean
}

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

  /**
   * Create a new client. Returns the freshly-created `Client` (with the
   * database-assigned `ID_Cliente`). Throws `RepositoryError` on validation
   * or transport failure; `role` is forwarded so the live backend can enforce
   * admin-only writes.
   */
  create(input: ClientCreateInput, role: RoleLike): Promise<Client>

  /**
   * Apply a partial update to a client. Throws `RepositoryError('not-found')`
   * when `id` doesn't match an existing client; the live backend may also
   * throw `RepositoryError('forbidden')` when the role is not admin.
   */
  update(id: number, patch: ClientUpdatePatch, role: RoleLike): Promise<Client>
}

export { RepositoryError } from './orders.repository'