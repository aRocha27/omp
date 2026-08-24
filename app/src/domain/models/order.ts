/**
 * Order domain models.
 *
 * Field names preserve the original Access/database identifiers verbatim
 * (AGENT.md §10, report.md §13) to keep traceability with the legacy system.
 * SQL types and nullability verified 2026-08-23 against BRKR_ERP (dbo):
 * - ID_Area / ID_Tipo are string codes ("BDAL", "INSTR"), not numbers.
 * - ID_Tp_Warranty / ID_Tp_Revenue are numbers (1, 2, 3), not strings.
 * - Client name comes from V_Order_List `nome` (aliased Client_Name); Client contact
 *   comes from the Client table join (`contacto` → Contacto). The legacy Order table has
 *   no Email column, so Email is mock-only and dropped from the live detail row.
 * - `upsize_ts` is a rowversion Buffer — opaque, never serialized; the HTTP layer strips it.
 */
export type OrderTypeId = string

/**
 * Confirmed Order fields from the Access relationships PDF, reconciled to the live
 * dbo.[Order] table. `upsize_ts` is an Access upsizing timestamp column — opaque here,
 * not a business field; the backend omits it from the JSON payload.
 */
export interface Order {
  ID_Order: number
  /** Order date. Stored as ISO string in the app layer; the DB column is NOT NULL. */
  DT_Order: string
  Order_Factory: boolean | null
  ID_Tp_Order: OrderTypeId | null
  /**
   * Provisional flag. The base dbo.[Order] table has no such column; this is the
   * `Provisoria` bit exposed by dbo.V_Order_List (true for every non-Client order
   * type — S/W/COM/CANC/WPO/...). A provisória order is always editable, regardless
   * of the month-close lock (see domain/orders/order-policy).
   */
  Provisoria: boolean | null
  Encomenda_Cli_PHC: string | null
  ID_Client: number | null
  /**
   * Client display name. The live detail endpoint joins the Client table and returns
   * this directly; the mock leaves it unset and the detail page falls back to
   * `resolveClientName(ID_Client)`.
   */
  Client_Name?: string | null
  /** Business area — string code (verified 2026-08-23). */
  ID_Area: string | null
  /** Order kind — string code (verified 2026-08-23). */
  ID_Tipo: string | null
  ID_Produto: number | null
  ID_Instrumento: number | null
  /** Budget/proposal reference (nvarchar in the DB, not a money amount). */
  Orc_Proposta: string | null
  PO_Cliente: string | null
  Sell_Price: number | null
  /** Warranty type — numeric code (verified 2026-08-23). */
  ID_Tp_Warranty: number | null
  Warranty_Reserve: number | null
  Warranty_DT_Inicio: string | null
  /** Revenue type — numeric code (verified 2026-08-23). */
  ID_Tp_Revenue: number | null
  Facturado: boolean | null
  Reconhecido: boolean | null
  Cod_Enc_Fornecedor: string | null
  Obs: string | null
  Negocio_Fechado: boolean | null
  ID_User: string | null
  DT_User: string | null
  upsize_ts: unknown
  Kit: boolean | null
  Kit_Amount: number | null
  /** Client contact — from the Client table join (`contacto`). */
  Contacto: string | null
  /** MOCK ONLY — the live Order/Client tables have no Email column. Kept for the mock. */
  Email: string | null
}

/**
 * Order list row. Backed by dbo.V_Order_List, which already joins the client name
 * (`nome` aliased Client_Name). Columns verified 2026-08-23 against BRKR_ERP.
 */
export interface OrderSummary {
  ID_Order: number
  DT_Order: string
  Order_Factory: boolean | null
  ID_Tp_Order: OrderTypeId | null
  /** Provisional flag from V_Order_List (see Order.Provisoria). */
  Provisoria: boolean | null
  ID_Client: number | null
  /** Display name from V_Order_List `nome` projection. */
  Client_Name: string | null
  /** Business area — string code (verified 2026-08-23). */
  ID_Area: string | null
  /** Order kind — string code (verified 2026-08-23). */
  ID_Tipo: string | null
  ID_Produto: number | null
  ID_Instrumento: number | null
  Sell_Price: number | null
  Negocio_Fechado: boolean | null
  Encomenda_Cli_PHC: string | null
}

/**
 * Confirmed order-list filters (AGENT.md §9).
 * All optional; absent/empty fields are not filtered.
 *
 * Categorical filters (order type, area, tipo, product, instrument) are
 * multi-select arrays — a row matches if its value is in the set (SQL `IN`).
 * Empty array / null = no filter. Boolean filters (`orderFactory`,
 * `negocioFechado`) are "only show…" toggles: `true` filters to that flag,
 * `false`/null = no filter (the UI can no longer filter to the false branch).
 */
export interface OrderSearchFilters {
  /** Order date from (inclusive), ISO date. */
  dateFrom?: string | null
  /** Order date to (inclusive), ISO date. */
  dateTo?: string | null
  /** Client name — contains match. */
  clientName?: string | null
  /** Factory-order flag — `true` keeps only factory orders. */
  orderFactory?: boolean | null
  /** Order type codes — row matches if `ID_Tp_Order` ∈ set. */
  idTpOrder?: OrderTypeId[] | null
  /** Business area codes — row matches if `ID_Area` ∈ set. */
  idArea?: string[] | null
  /** Order kind codes — row matches if `ID_Tipo` ∈ set. */
  idTipo?: string[] | null
  /** Product ids — row matches if `ID_Produto` ∈ set. */
  idProduto?: number[] | null
  /** Instrument ids — row matches if `ID_Instrumento` ∈ set. */
  idInstrumento?: number[] | null
  /** PHC order number — match on `Encomenda_Cli_PHC`. */
  encomendaCliPHC?: string | null
  /** Closed-deal flag (`Negocio_Fechado`) — `true` keeps only closed deals. */
  negocioFechado?: boolean | null
}

/** Normalised filters with inactive values stripped (used by repositories). */
export type NormalisedOrderSearchFilters = {
  [K in keyof OrderSearchFilters]: NonNullable<OrderSearchFilters[K]>
}

/** Strip inactive filter values so repositories only act on set filters:
 * null/undefined/'' (strings), empty arrays (categoricals), and `false`
 * (the boolean "only show…" toggles — `false` means "no filter"). */
export function normaliseOrderFilters(
  filters: OrderSearchFilters,
): Partial<NormalisedOrderSearchFilters> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined) continue
    if (value === '') continue
    if (Array.isArray(value) && value.length === 0) continue
    if (value === false) continue
    result[key] = value
  }
  return result as Partial<NormalisedOrderSearchFilters>
}