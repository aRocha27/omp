/**
 * Revenue recognition entry. Mirrors dbo.Reconhecimento (verified 2026-08-24):
 *   ID_Reconhecimento int PK, ID_Order int, ID_Tp_Reconhecimento nvarchar,
 *   DT_Reconhecimento datetime, Valor_Reconhecimento money, ID_User, DT_User.
 *
 * The `upsize_ts` rowversion is omitted (opaque, never serialized).
 * Field names preserve the legacy DB identifiers for traceability.
 */
export interface Reconhecimento {
  ID_Reconhecimento: number
  ID_Order: number
  /** Recognition type code → dbo.Tp_Reconhecimento (CM/P/T/W/WP). */
  ID_Tp_Reconhecimento: string | null
  /** Recognition date — ISO 8601 UTC string in the app layer. */
  DT_Reconhecimento: string | null
  Valor_Reconhecimento: number | null
  ID_User: string | null
  DT_User: string | null
}