/**
 * Repository contract for the Reconhecimento (revenue recognition) sub-table.
 *
 * UI code depends on this interface, never on a concrete mock/HTTP implementation.
 * Mock and live HTTP repositories implement the same read, mutation, and propagation
 * behavior so the detail page does not depend on the active data mode.
 */
import type { Reconhecimento } from '@/domain/models/reconhecimento'
import type { Role } from '@/domain/models/user'

// Re-export so HTTP/mock implementations and callers import the shared error
// type from their own contract (mirrors clients.repository).
export { RepositoryError } from './orders.repository'

/**
 * Shape callers use when adding a recognition entry. The PK and audit columns
 * (`ID_Reconhecimento`, `ID_User`, `DT_User`) are assigned by the repository —
 * `ID_User` is optional so the mock can default it to the acting user.
 *
 * `ID_Tp_Reconhecimento`, `DT_Reconhecimento`, and `Valor_Reconhecimento` are
 * required (non-null) to mirror the live Zod schema in `server/src/validation.ts`:
 * the UI validates these before the call, and the server rejects nulls. Keeping
 * the write contract non-null means mock and live behave identically.
 */
export type NewReconhecimento = {
  ID_Order: number
  ID_Tp_Reconhecimento: string
  DT_Reconhecimento: string
  Valor_Reconhecimento: number
  ID_User?: string | null
}

/**
 * Patch for editing an existing recognition entry. The PK (`ID_Reconhecimento`)
 * and audit columns are not editable here; the repository re-stamps `ID_User` /
 * `DT_User` on success. `ID_Order` is fixed (the entry stays on its order).
 */
export type ReconhecimentoPatch = Partial<
  Pick<Reconhecimento, 'ID_Tp_Reconhecimento' | 'DT_Reconhecimento' | 'Valor_Reconhecimento'>
>

/**
 * Parameters for the automatic monthly propagation of recognition entries.
 *
 * `kind: 'warranty'` generates `WP` (Warranty Parcial) lines starting at
 * `Warranty_DT_Inicio + 12 months`, dividing `Warranty_Reserve` by
 * `(N_Anos − 1) × 12` months — only when the order's `Tipo.Warranty` is true.
 * The order itself supplies every parameter, so no extra fields are needed.
 *
 * `kind: 'maintenance'` generates `CM` (C Manut) lines for a Maintenance
 * Contract order (`ID_Tipo === 'CM'`), dividing `Sell_Price` by
 * `years × 12` months starting at `startDate`. The contract start and number
 * of years are not persisted (the DB has no columns for them), so they must be
 * supplied each time.
 */
export interface PropagateReconhecimentoInput {
  kind: 'warranty' | 'maintenance'
  /** Required for `kind: 'maintenance'` — ISO 8601 UTC date of the contract start. */
  startDate?: string
  /** Required for `kind: 'maintenance'` — contract duration in years (≥ 1). */
  years?: number
}

/**
 * Read + write path for a single order's recognition entries.
 *
 * `listByOrder` backs the Revenue tab of the order detail page; `add`/`update`/
 * `remove` back the inline edit/delete actions; `propagate` backs the
 * "Propagar garantia" / "Propagar contrato" buttons.
 */
export interface ReconhecimentoRepository {
  /** All recognition entries for a given `ID_Order`, ordered by `DT_Reconhecimento`. */
  listByOrder(orderId: number): Promise<Reconhecimento[]>

  /** Append a new recognition entry. Assigns the PK and audit columns. */
  add(entry: NewReconhecimento, role: Role): Promise<Reconhecimento>

  /** Edit an existing entry by PK. Re-stamps the audit user; revalidates capacity. */
  update(id: number, patch: ReconhecimentoPatch, role: Role): Promise<Reconhecimento>

  /** Hard-delete an existing entry by PK (dbo.Reconhecimento has no deleted_at). */
  remove(id: number, role: Role): Promise<void>

  /**
   * Generate monthly recognition lines for a warranty or maintenance-contract
   * order. Returns the created entries. The server revalidates total capacity
   * within the propagation transaction and rolls back if it would exceed
   * `Sell_Price`.
   */
  propagate(
    orderId: number,
    input: PropagateReconhecimentoInput,
    role: Role,
  ): Promise<Reconhecimento[]>
}
