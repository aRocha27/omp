/**
 * Order domain models.
 *
 * Field names preserve the original Access/database identifiers verbatim
 * (AGENT.md §10, report.md §13) to keep traceability with the legacy system.
 * Actual SQL types and nullability are NOT verified yet — money/date fields are
 * modelled as `number | null` / `string | null` until real DB metadata arrives.
 * See docs/context/MOCK_DATA_CONTRACT.md §4 (known-vs-assumed fields).
 */

/** Order type code (maps to `Order.ID_Tp_Order`). Exact domain values not yet supplied. */
export type OrderTypeId = string

/**
 * Confirmed Order fields from the Access relationships PDF.
 * `upsize_ts` is an Access upsizing timestamp column — opaque here, not a business field.
 */
export interface Order {
  ID_Order: number
  /** Order date. Stored as ISO string in the app layer; actual column type unverified. */
  DT_Order: string
  Order_Factory: boolean | null
  ID_Tp_Order: OrderTypeId | null
  Encomenda_Cli_PHC: string | null
  ID_Client: number | null
  ID_Area: number | null
  ID_Tipo: number | null
  ID_Produto: number | null
  ID_Instrumento: number | null
  Orc_Proposta: number | null
  PO_Cliente: string | null
  Sell_Price: number | null
  ID_Tp_Warranty: string | null
  Warranty_Reserve: number | null
  Warranty_DT_Inicio: string | null
  ID_Tp_Revenue: string | null
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
  Contacto: string | null
  Email: string | null
}

/**
 * Order list row.
 *
 * Access source is `select * from V_Order_List` (AGENT.md §9), but the view's
 * column list is NOT supplied. This summary models the fields referenced by the
 * confirmed filters and list ordering, plus a client display name.
 *
 * TODO(source-verification): confirm V_Order_List columns against the real DB.
 */
export interface OrderSummary {
  ID_Order: number
  DT_Order: string
  Order_Factory: boolean | null
  ID_Tp_Order: OrderTypeId | null
  ID_Client: number | null
  /** Display name; expected from the V_Order_List projection (unverified). */
  Client_Name: string | null
  ID_Area: number | null
  ID_Tipo: number | null
  ID_Produto: number | null
  ID_Instrumento: number | null
  Sell_Price: number | null
  Negocio_Fechado: boolean | null
  Encomenda_Cli_PHC: string | null
}

/**
 * Confirmed order-list filters (AGENT.md §9).
 * All optional; absent fields are not filtered.
 */
export interface OrderSearchFilters {
  /** Order date from (inclusive), ISO date. */
  dateFrom?: string | null
  /** Order date to (inclusive), ISO date. */
  dateTo?: string | null
  /** Client name — contains match. */
  clientName?: string | null
  /** Factory-order boolean. */
  orderFactory?: boolean | null
  idTpOrder?: OrderTypeId | null
  idArea?: number | null
  idTipo?: number | null
  idProduto?: number | null
  idInstrumento?: number | null
  /** PHC order number — match on `Encomenda_Cli_PHC`. */
  encomendaCliPHC?: string | null
  /** Closed-deal boolean (`Negocio_Fechado`). */
  negocioFechado?: boolean | null
}

/** Normalised filters with nullish values stripped (used by repositories). */
export type NormalisedOrderSearchFilters = {
  [K in keyof OrderSearchFilters]: NonNullable<OrderSearchFilters[K]>
}

/** Strip null/undefined/'' filter values so repositories only act on set filters. */
export function normaliseOrderFilters(
  filters: OrderSearchFilters,
): Partial<NormalisedOrderSearchFilters> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined || value === '') continue
    result[key] = value
  }
  return result as Partial<NormalisedOrderSearchFilters>
}