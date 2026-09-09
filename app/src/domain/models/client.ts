/**
 * Client domain models.
 *
 * Field names preserve the original Access/database identifiers verbatim
 * (matching the Orders convention) to keep traceability with the source system.
 * SQL types and nullability verified against the demo schema:
 * - `ID_Cliente` is the primary key (numeric).
 * - `no_PHC` is the PHC system reference (nullable).
 * - `ID_Tp_Cliente` is the client-type code (numeric, nullable) — see `tpClientes`.
 * - `upsize_ts` is a rowversion Buffer the backend strips; it never reaches the app.
 */

/** Client list row (POST /clients/list). */
export interface ClientSummary {
  ID_Cliente: number
  no_PHC: number | null
  ID_Tp_Cliente: number | null
  nome: string | null
  ncont: string | null
  telefone: string | null
  local: string | null
}

/** Client detail row (GET /clients?id=N). */
export interface Client {
  ID_Cliente: number
  no_PHC: number | null
  ID_Tp_Cliente: number | null
  nome: string | null
  ncont: string | null
  fax: string | null
  telefone: string | null
  contacto: string | null
  morada: string | null
  local: string | null
  codpost: string | null
  zona: string | null
  Defense: boolean | null
}

/**
 * Client list filters.
 *
 * `search` is a contains-match over name/tax no./SAP no. (the backend decides the
 * columns). `idTpCliente` is a multi-select of client-type codes — a row matches if
 * its `ID_Tp_Cliente` is in the set. Empty string / empty array mean "no filter".
 */
export interface ClientSearchFilters {
  search: string
  idTpCliente: number[]
}

/** Normalised filters with inactive values stripped (used by repositories + query keys). */
export type NormalisedClientSearchFilters = {
  [K in keyof ClientSearchFilters]: NonNullable<ClientSearchFilters[K]>
}

/**
 * Strip inactive filter values so repositories only act on set filters:
 * empty/whitespace `search` and empty `idTpCliente` arrays are dropped.
 */
export function normaliseClientFilters(
  filters: ClientSearchFilters,
): Partial<NormalisedClientSearchFilters> {
  const result: Record<string, unknown> = {}
  const search = filters.search.trim()
  if (search) result.search = search
  if (filters.idTpCliente.length > 0) result.idTpCliente = filters.idTpCliente
  return result as Partial<NormalisedClientSearchFilters>
}