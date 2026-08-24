/**
 * Repository contract for the Facturacao (invoicing documents) sub-table.
 *
 * UI code depends on this interface, never on a concrete mock/HTTP implementation.
 * `MockDocumentoFaturacaoRepository` backs this slice now; a live read path against
 * dbo.Facturacao is a flagged follow-up (INTEGRATION_PLAN.md).
 */
import type { DocumentoFaturacao } from '@/domain/models/documento-faturacao'
import type { Role } from '@/domain/models/user'

// Re-export so HTTP/mock implementations and callers import the shared error
// type from their own contract (mirrors clients.repository).
export { RepositoryError } from './orders.repository'

/**
 * Shape callers use when adding an invoicing document. The PK and audit columns
 * (`ID_Facturacao`, `ID_User`, `DT_User`) are assigned by the repository —
 * `ID_User` is optional so the mock can default it to the acting user.
 */
export type NewDocumentoFaturacao = Omit<
  DocumentoFaturacao,
  'ID_Facturacao' | 'ID_User' | 'DT_User'
> & { ID_User?: string | null }

/**
 * Read + (mock-only) write path for a single order's invoicing documents.
 *
 * `listByOrder` backs the Invoicing tab of the order detail page; `add` backs the
 * `[+ Documento]` action during the UI-first phase (live write is a follow-up).
 */
export interface DocumentoFaturacaoRepository {
  /** All invoicing documents for a given `ID_Order`, ordered by `DT_Doc_FT`. */
  listByOrder(orderId: number): Promise<DocumentoFaturacao[]>

  /** Append a new invoicing document. Assigns the PK and audit columns. */
  add(entry: NewDocumentoFaturacao, role?: Role): Promise<DocumentoFaturacao>
}
