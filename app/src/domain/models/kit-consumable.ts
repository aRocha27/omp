/**
 * Kit consumable entry. Mirrors dbo.Kit_Consumables (verified 2026-08-25 against
 * BRKR_ERP):
 *   ID_Kit int PK (identity), ID_Order int (→ dbo.[Order]), Date datetime,
 *   Internal_Order/Material/Description nvarchar, Quant int,
 *   Unit_Price/Total_Price money.
 *
 * Unlike Reconhecimento/Facturacao this table has no ID_User/DT_User audit
 * columns, so none are modelled. Field names preserve the legacy DB identifiers
 * for traceability (AGENT.md §10). `Total_Price` is typically `Quant * Unit_Price`
 * and is sent by the client; the Saldo shown in the UI is
 * `Kit_Amount − Σ Total_Price` for the order.
 */
export interface KitConsumable {
  ID_Kit: number
  ID_Order: number
  /** Consumption date — ISO 8601 UTC string in the app layer. */
  Date: string | null
  Internal_Order: string | null
  Material: string | null
  Description: string | null
  Quant: number | null
  Unit_Price: number | null
  Total_Price: number | null
}