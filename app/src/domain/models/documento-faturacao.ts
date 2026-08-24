/**
 * Invoicing document entry. Mirrors dbo.Facturacao (verified 2026-08-24):
 *   ID_Facturacao int PK, ID_Order int, DT_Doc_FT datetime, ID_Tp_Doc_FT nvarchar,
 *   N_Doc_FT nvarchar, Valor_Doc_FT money, ID_User, DT_User.
 *
 * The `upsize_ts` rowversion is omitted (opaque, never serialized).
 * Field names preserve the legacy DB identifiers for traceability.
 */
export interface DocumentoFaturacao {
  ID_Facturacao: number
  ID_Order: number
  /** Document date — ISO 8601 UTC string in the app layer. */
  DT_Doc_FT: string | null
  /** Document type code → dbo.Tp_Doc_FT (AcFT/FT/NC). */
  ID_Tp_Doc_FT: string | null
  N_Doc_FT: string | null
  Valor_Doc_FT: number | null
  ID_User: string | null
  DT_User: string | null
}