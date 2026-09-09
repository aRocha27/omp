/**
 * Repository contract for the Facturacao (invoicing documents) sub-table.
 *
 * UI code depends on this interface, never on a concrete mock/HTTP implementation.
 * Mock and live HTTP repositories implement the same read and mutation behavior so
 * the detail page does not depend on the active data mode.
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
 *
 * `DT_Doc_FT`, `ID_Tp_Doc_FT`, `N_Doc_FT`, and `Valor_Doc_FT` are required
 * (non-null) to mirror the live Zod schema in `server/src/validation.ts`: the UI
 * validates these before the call, and the server rejects nulls. Keeping the
 * write contract non-null means mock and live behave identically.
 */
export type NewDocumentoFaturacao = {
  ID_Order: number
  DT_Doc_FT: string
  ID_Tp_Doc_FT: string
  N_Doc_FT: string
  Valor_Doc_FT: number
  ID_User?: string | null
}

/**
 * Patch for editing an existing invoicing document. The PK (`ID_Facturacao`)
 * and audit columns are not editable; the repository re-stamps `ID_User` /
 * `DT_User`. `ID_Order` is fixed. Per req 2, the document type is the
 * `tp_doc_ft` field (`ID_Tp_Doc_FT`), not `id_tp_doc_ft`.
 */
export type DocumentoFaturacaoPatch = Partial<
  Pick<
    DocumentoFaturacao,
    | 'DT_Doc_FT'
    | 'ID_Tp_Doc_FT'
    | 'N_Doc_FT'
    | 'Valor_Doc_FT'
    | 'Imprimiu'
    | 'Imp_Block'
    | 'Nome_PDF'
    | 'E_Invoice'
  >
>

export interface DocumentoFaturacaoType {
  id: string
  label: string
}

/**
 * Read + write path for a single order's invoicing documents.
 *
 * `listByOrder` backs the Invoicing tab of the order detail page; `add`/`update`/
 * `remove` back the inline edit/delete actions.
 */
export interface DocumentoFaturacaoRepository {
  /** Document types read from dbo.Tp_Doc_FT (fixture-backed in mock mode). */
  listTypes(): Promise<DocumentoFaturacaoType[]>

  /** All invoicing documents for a given `ID_Order`, ordered by `DT_Doc_FT`. */
  listByOrder(orderId: number): Promise<DocumentoFaturacao[]>

  /** All invoicing documents, optionally restricted to an inclusive date range. */
  listAll(filters?: { from?: string; to?: string }): Promise<DocumentoFaturacao[]>

  /** Append a new invoicing document. Assigns the PK and audit columns. */
  add(entry: NewDocumentoFaturacao, role: Role): Promise<DocumentoFaturacao>

  /** Edit an existing document by PK. Re-stamps the audit user; revalidates net ≤ Sell_Price. */
  update(id: number, patch: DocumentoFaturacaoPatch, role: Role): Promise<DocumentoFaturacao>

  /** Hard-delete an existing document by PK (dbo.Facturacao has no deleted_at). */
  remove(id: number, role: Role): Promise<void>
}
