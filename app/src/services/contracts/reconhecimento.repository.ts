/**
 * Repository contract for the Reconhecimento (revenue recognition) sub-table.
 *
 * UI code depends on this interface, never on a concrete mock/HTTP implementation.
 * `MockReconhecimentoRepository` backs this slice now; a live read path against
 * dbo.Reconhecimento is a flagged follow-up (INTEGRATION_PLAN.md).
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
 */
export type NewReconhecimento = Omit<
  Reconhecimento,
  'ID_Reconhecimento' | 'ID_User' | 'DT_User'
> & { ID_User?: string | null }

/**
 * Read + (mock-only) write path for a single order's recognition entries.
 *
 * `listByOrder` backs the Revenue tab of the order detail page; `add` backs the
 * `[+ Reconhecimento]` action during the UI-first phase (live write is a follow-up).
 */
export interface ReconhecimentoRepository {
  /** All recognition entries for a given `ID_Order`, ordered by `DT_Reconhecimento`. */
  listByOrder(orderId: number): Promise<Reconhecimento[]>

  /** Append a new recognition entry. Assigns the PK and audit columns. */
  add(entry: NewReconhecimento, role?: Role): Promise<Reconhecimento>
}
