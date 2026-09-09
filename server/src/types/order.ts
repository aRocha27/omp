/**
 * Orders read/write wire types.
 *
 * `OrderSummaryRow` mirrors the reconciled frontend `OrderSummary`
 * (Client_Name is aliased from the V_Order_List `nome` column;
 * ID_Area/ID_Tipo are string codes, ID_Produto/ID_Instrumento are
 * numbers). Verified against the demo schema.
 */

export type OrderSummaryRow = {
  ID_Order: number
  DT_Order: string
  Order_Factory: boolean | null
  ID_Tp_Order: string | null
  ID_Client: number | null
  Client_Name: string | null
  ID_Area: string | null
  ID_Tipo: string | null
  ID_Produto: number | null
  ID_Instrumento: number | null
  Sell_Price: number | null
  Negocio_Fechado: boolean | null
  Encomenda_Cli_PHC: string | null
  // Order-table-only columns the view does not project. Joined from dbo.[Order] so the list
  // can render the full 19-column grid without a second round-trip per row.
  // Verified against the demo schema.
  Kit: boolean | null
  ID_Tp_Warranty: number | null
  Warranty_Reserve: number | null
  Warranty_DT_Inicio: string | null
  Orc_Proposta: string | null
  PO_Cliente: string | null
  ID_Tp_Revenue: number | null
  /** Canonical labels resolved from dbo lookup tables by the list query. */
  Tp_Order_Label?: string | null
  Area_Label?: string | null
  Tipo_Label?: string | null
  Produto_Label?: string | null
  Instrumento_Label?: string | null
  Tp_Warranty_Label?: string | null
  Tp_Revenue_Label?: string | null
  // Provisoria flags a provisional order. Provisional rows are always editable even when
  // histórico (past month) — the "bloqueio de caracterização após fecho do mês" rule only
  // locks non-provisional histórico orders. Sourced from V_Order_List (bit column).
  Provisoria: boolean | null
}

// Full order detail. Adds the Order-table-only fields the view lacks (ID_Tp_Revenue,
// Facturado, Reconhecido, Cod_Enc_Fornecedor, Obs, ID_User, DT_User, Kit_Amount) and the
// order contact fields projected from dbo.[Order]. `upsize_ts` (rowversion Buffer) is
// intentionally omitted — it is opaque and must never be serialized to JSON. Orc_Proposta
// is nvarchar in the DB (a budget/proposal reference, not money), so it is exposed as a
// string. Provisoria is inherited from OrderSummaryRow (resolved via V_Order_List).
export type OrderDetailRow = OrderSummaryRow & {
  /** dbo.Tipo.Warranty, resolved by joining Order.ID_Tipo to Tipo.ID_Tipo. */
  Tipo_Warranty: boolean | null
  Facturado: boolean | null
  Reconhecido: boolean | null
  Cod_Enc_Fornecedor: string | null
  Obs: string | null
  ID_User: string | null
  DT_User: string | null
  Kit_Amount: number | null
  Contacto: string | null
  Email: string | null
  Audit?: string | null
}

export type OkOrders = {
  ok: true
  orders: OrderSummaryRow[]
}

export type OrderSortId =
  | 'DT_Order'
  | 'ID_Order'
  | 'Encomenda_Cli_PHC'
  | 'Order_Factory'
  | 'Kit'
  | 'Client_Name'
  | 'Sell_Price'
  | 'ID_Client'
  | 'ID_Tp_Order'
  | 'ID_Area'
  | 'ID_Tipo'
  | 'ID_Produto'
  | 'ID_Instrumento'
  | 'Negocio_Fechado'
  | 'ID_Tp_Warranty'
  | 'Warranty_Reserve'
  | 'Warranty_DT_Inicio'
  | 'Orc_Proposta'
  | 'PO_Cliente'
  | 'ID_Tp_Revenue'

export type OrderPageSort = { id: OrderSortId; direction: 'asc' | 'desc' }
export type OrderPageRequest = {
  filters: import('./filters').OrderListFilters
  sort: OrderPageSort
  limit: number
  offset?: number
  cursor?: string
}
export type OrderPage = {
  items: OrderSummaryRow[]
  nextCursor: string | null
  total: number
}
export type OkOrderPage = { ok: true } & OrderPage

export type OrderFacetOption = { id: string | number; label: string | null }
export type OrderFacets = {
  idTpOrder: OrderFacetOption[]
  idArea: OrderFacetOption[]
  idTipo: OrderFacetOption[]
  idProduto: OrderFacetOption[]
  idInstrumento: OrderFacetOption[]
}

export type OkOrder = {
  ok: true
  order: OrderDetailRow | null
}

export type OkOrderUpdate = {
  ok: true
  order: OrderDetailRow
}

export type OkOrderCreate = {
  ok: true
  order: OrderDetailRow
}

export type OrderWarrantyYearsUpdate = {
  id: number
  years: number
}

// Subset of dbo.[Order] columns an editor may patch. Column names mirror the SQL columns
// exactly (snake_case, uppercase) so the db layer can build the SET clause without
// translation. Every field is optional; the route enforces which fields a given role may
// touch. `user` (the acting username, written to ID_User) is added by the route, not the
// client. Keep this list in sync with UPDATEABLE_COLUMNS in db.ts.
export type OrderUpdatePatch = {
  DT_Order?: string | null
  Order_Factory?: boolean | null
  ID_Tp_Order?: string | null
  Encomenda_Cli_PHC?: string | null
  ID_Client?: number | null
  ID_Area?: string | null
  ID_Tipo?: string | null
  ID_Produto?: number | null
  ID_Instrumento?: number | null
  Orc_Proposta?: string | null
  PO_Cliente?: string | null
  Email?: string | null
  Contacto?: string | null
  Sell_Price?: number | null
  ID_Tp_Warranty?: number | null
  Warranty_Reserve?: number | null
  Warranty_DT_Inicio?: string | null
  ID_Tp_Revenue?: number | null
  Facturado?: boolean | null
  Reconhecido?: boolean | null
  Cod_Enc_Fornecedor?: string | null
  Obs?: string | null
  Negocio_Fechado?: boolean | null
  Kit?: boolean | null
  Kit_Amount?: number | null
  Audit?: string | null
}

// What the route hands to updateOrder: the column patch plus the acting username that
// gets written to ID_User on every UPDATE.
export type OrderUpdateChanges = OrderUpdatePatch & {
  user: string
}

export type OrderCreateInput = Omit<
  OrderUpdatePatch,
  'Facturado' | 'Reconhecido' | 'Negocio_Fechado'
> & {
  ID_Tp_Order: string
  ID_Client: number
}
