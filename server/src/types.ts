// Shared types for the Administration backend.
// Mirrored by app/src/domain/models/database-connection-profile.ts (same repo,
// same language, kept in sync). A workspace shared-package is overkill for one
// type.

export type NetworkMode = 'lan' | 'private-remote' | 'cloud'

export type DatabaseConnectionProfile = {
  id: string
  name: string
  networkMode: NetworkMode
  server: string
  port: number
  database?: string
  user: string
  schema?: string
  table?: string
  // NOTE: no `password` here — profile metadata never holds the secret.
  // Password is either ephemeral (ad-hoc, in request body) or in the backend
  // secret store (profile env vars now, Azure Key Vault later).
}

// Connection config used to open an mssql pool. The password only ever lives
// here, in memory, for the duration of one request.
export type ConnectionConfig = {
  server: string
  port: number
  database?: string
  user: string
  password: string
  /** Defaults to true; backend-managed profiles can override for their SQL Server. */
  encrypt?: boolean
  /** Defaults to false so SQL Server certificates are validated unless explicitly overridden. */
  trustServerCertificate?: boolean
}

export type TableInfo = {
  schema: string
  name: string
  type: string
}

export type OkTables = {
  ok: true
  tables: TableInfo[]
}

export type OkRows = {
  ok: true
  columns: string[]
  rows: Record<string, unknown>[]
}

export type TableRows = {
  schema: string
  name: string
  columns: string[]
  rows: Record<string, unknown>[]
}

export type OkAllTables = {
  ok: true
  tables: TableRows[]
}

export type Err = {
  ok: false
  code: ApiErrorCode
  message: string
}

export type ErrorCode = 'login-failed' | 'timeout' | 'unreachable' | 'permission' | 'unknown'
export type ApiErrorCode =
  | ErrorCode
  | 'validation'
  | 'profile'
  | 'table-not-available'
  | 'ad-hoc-disabled'
  | 'unauthorized'
  | 'orders-not-configured'
  | 'forbidden'
  | 'field-locked'
  | 'not-found'
  | 'capacity-exceeded'

// Orders read path. `OrderSummaryRow` mirrors the reconciled frontend `OrderSummary`
// (Client_Name is aliased from the V_Order_List `nome` column; ID_Area/ID_Tipo are string
// codes, ID_Produto/ID_Instrumento are numbers). Verified 2026-08-23 against BRKR_ERP.
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
  // can render the full 19-column grid without a second round-trip per row. Verified
  // 2026-08-25 against BRKR_ERP.
  Kit: boolean | null
  ID_Tp_Warranty: number | null
  Warranty_Reserve: number | null
  Warranty_DT_Inicio: string | null
  Orc_Proposta: string | null
  PO_Cliente: string | null
  ID_Tp_Revenue: number | null
  // Provisoria flags a provisional order. Provisional rows are always editable even when
  // histórico (past month) — the "bloqueio de caracterização após fecho do mês" rule only
  // locks non-provisional histórico orders. Sourced from V_Order_List (bit column).
  Provisoria: boolean | null
}

// Full order detail. Adds the Order-table-only fields the view lacks (ID_Tp_Revenue,
// Facturado, Reconhecido, Cod_Enc_Fornecedor, Obs, ID_User, DT_User, Kit_Amount) and the
// client contact resolved via the Client join. `upsize_ts` (rowversion Buffer) is
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
}

export type OkOrders = {
  ok: true
  orders: OrderSummaryRow[]
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

export type DashboardKpisRow = {
  ordersBookedYtd: number
  nobYtd: number
  revenueRecognizedYtd: number
  backlogToRecognize: number
  backlogAtPeriodStart: number
}

export type DashboardTrendPointRow = {
  monthStart: string
  revenue: number
  nob: number
}

export type DashboardRecognitionQueueRow = {
  idOrder: number | null
  encPhc: string | null
  orderDate: string | null
  client: string | null
  area: string | null
  product: string | null
  type: string | null
  sellPrice: number | null
  recognizedValue: number | null
  remainingValue: number | null
  invoiced: boolean | null
}

export type DashboardSnapshotRow = {
  year: number
  kpis: DashboardKpisRow
  monthlyTrend: DashboardTrendPointRow[]
  recognitionQueue: DashboardRecognitionQueueRow[]
  recentOrders: OrderSummaryRow[]
}

export type OkDashboard = {
  ok: true
  dashboard: DashboardSnapshotRow
}

export type OkRecognitionQueue = {
  ok: true
  recognitionQueue: DashboardRecognitionQueueRow[]
}

/**
 * Row shape for the Recognition report (crosstab view
 * `dbo.V_Reconhecimento_Monthly_Crosstab`).
 *
 * Dimensions:
 *  - `Year_Recognition` is nullable in the source view: rows whose year
 *    couldn't be derived from the recognition date still appear, with NULL.
 *  - `Cliente` is the raw client name from the view, used as display text.
 *
 * Measures:
 *  - `Sell_Price` (one column, year-agnostic): the order sell price.
 *  - The 12 monthly values are decimal numbers (may be 0 for a month with no
 *    recognition posting on that row).
 *  - `Total_Year` matches the sum of the 12 month columns for the same row
 *    (the view's own column — kept verbatim so the spreadsheet matches the
 *    server-rendered numbers exactly).
 */
export interface RecognitionReportRow {
  yearRecognition: number | null
  area: string | null
  grpReport: string | null
  tipo: string | null
  produto: string | null
  encomendaCliPHC: string | null
  cliente: string | null
  sellPrice: number | null
  tpReconhecimento: string | null
  january: number
  february: number
  march: number
  april: number
  may: number
  june: number
  july: number
  august: number
  september: number
  october: number
  november: number
  december: number
  totalYear: number
}

export interface RecognitionReportOptions {
  years: number[]
  areas: string[]
  grpReports: string[]
  tipos: string[]
  produtos: string[]
  encomendas: string[]
}

export type OkRecognitionReport = {
  ok: true
  rows: RecognitionReportRow[]
}

export type OkRecognitionReportOptions = {
  ok: true
  options: RecognitionReportOptions
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
}

// What the route hands to updateOrder: the column patch plus the acting username that
// gets written to ID_User on every UPDATE.
export type OrderUpdateChanges = OrderUpdatePatch & {
  user: string
}

export type OrderCreateInput = Omit<
  OrderUpdatePatch,
  'Facturado' | 'Reconhecido' | 'Negocio_Fechado' | 'ID_Tp_Revenue'
> & {
  DT_Order: string
  ID_Tp_Order: string
  ID_Client: number
  ID_Tp_Revenue: number
}

export type ProfileMetadata = {
  id: string
  name: string
  networkMode: NetworkMode
}

// Clients read path. `ClientSummaryRow` is the list projection of dbo.Client — the columns
// the Orders/clients pickers need to identify and disambiguate a client. `ncont` (tax number)
// and `no_PHC` (PHC short code) are numeric on the wire. `ID_Tp_Cliente` is the raw FK; the
// frontend resolves the label from reference data. Verified 2026-08-24 against BRKR_ERP.
export type ClientSummaryRow = {
  ID_Cliente: number
  no_PHC: number | null
  ID_Tp_Cliente: number | null
  nome: string | null
  ncont: number | null
  telefone: string | null
  local: string | null
}

// Full client detail. Exposes every dbo.Client column except `upsize_ts` (rowversion Buffer,
// opaque, never serialized). `Defense` (bit) is exposed as a boolean. The raw `ID_Tp_Cliente`
// is kept — the frontend resolves the Tp_Cliente label client-side.
export type ClientDetailRow = {
  ID_Cliente: number
  no_PHC: number | null
  ID_Tp_Cliente: number | null
  nome: string | null
  ncont: number | null
  fax: string | null
  telefone: string | null
  contacto: string | null
  morada: string | null
  local: string | null
  codpost: string | null
  zona: string | null
  Defense: boolean | null
}

export type OkClients = {
  ok: true
  clients: ClientSummaryRow[]
}

export type OkClient = {
  ok: true
  client: ClientDetailRow | null
}

export type OkClientCreate = {
  ok: true
  client: ClientDetailRow
}

export type OkClientUpdate = {
  ok: true
  client: ClientDetailRow
}

// Wire shape for `POST /api/clients`. The seven user-required fields are mandatory;
// everything else is optional so the form can flesh out a client over time. Field
// names match dbo.Client columns (snake_case uppercase) so the db layer builds the
// INSERT clause without translation.
export type ClientCreateInput = {
  nome: string
  morada: string
  local: string
  codpost: string
  no_PHC: number
  ncont: string
  ID_Tp_Cliente: number
  telefone?: string | null
  contacto?: string | null
  fax?: string | null
  zona?: string | null
}

// Wire shape for `POST /api/clients/update`. `patch` is partial — every field is
// optional and nullable (so the route can clear a value by sending null). The
// `user` field is added by the route from the request context, never from the body.
export type ClientUpdatePatch = {
  no_PHC?: number | null
  ID_Tp_Cliente?: number | null
  nome?: string | null
  ncont?: string | null
  fax?: string | null
  telefone?: string | null
  contacto?: string | null
  morada?: string | null
  local?: string | null
  codpost?: string | null
  zona?: string | null
  Defense?: boolean | null
}

export type ClientUpdateChanges = ClientUpdatePatch & {
  user: string
}

// Order sub-table rows. Field names mirror the frontend models exactly
// (app/src/domain/models/reconhecimento.ts, documento-faturacao.ts) so the HTTP repos map
// cleanly. `upsize_ts` is intentionally omitted (opaque, never serialized). Verified
// 2026-08-24 against BRKR_ERP.
export type ReconhecimentoRow = {
  ID_Reconhecimento: number
  ID_Order: number
  ID_Tp_Reconhecimento: string | null
  DT_Reconhecimento: string | null
  Valor_Reconhecimento: number | null
  ID_User: string | null
  DT_User: string | null
}

export type DocumentoFaturacaoTypeRow = {
  id: string
  label: string
}

// Reference cascade rows for Área → Produto → Instrumento (dbo.Area/Produto/Instrumento).
// `area` on Produto and `produto` on Instrumento carry the parent id so the frontend can drive
// dependent dropdowns without a second round-trip. Verified 2026-08-25 against BRKR_ERP.
export type AreaRow = { id: string; label: string }
export type ProdutoRow = { id: number; label: string; area: string | null }
export type InstrumentoRow = { id: number; label: string; produto: number | null }

export type OkAreas = { ok: true; areas: AreaRow[] }
export type OkProdutos = { ok: true; produtos: ProdutoRow[] }
export type OkInstrumentos = { ok: true; instrumentos: InstrumentoRow[] }

export type DocumentoFaturacaoRow = {
  ID_Facturacao: number
  ID_Order: number
  DT_Doc_FT: string | null
  ID_Tp_Doc_FT: string | null
  N_Doc_FT: string | null
  Valor_Doc_FT: number | null
  ID_User: string | null
  DT_User: string | null
}

export type OkReconhecimentos = {
  ok: true
  rows: ReconhecimentoRow[]
}

export type OkFacturacao = {
  ok: true
  rows: DocumentoFaturacaoRow[]
}

// Kit_Consumables sub-table. Mirrors dbo.Kit_Consumables (verified 2026-08-25 against
// BRKR_ERP): ID_Kit int PK (identity), ID_Order int (→ dbo.[Order]), Date datetime,
// Internal_Order/Material/Description nvarchar, Quant int, Unit_Price/Total_Price money.
// Unlike Reconhecimento/Facturacao this table has no ID_User/DT_User audit columns, so
// none are exposed. Field names mirror app/src/domain/models/kit-consumable.ts exactly.
export type KitConsumableRow = {
  ID_Kit: number
  ID_Order: number
  Date: string | null
  Internal_Order: string | null
  Material: string | null
  Description: string | null
  Quant: number | null
  Unit_Price: number | null
  Total_Price: number | null
}

export type OkKitConsumables = {
  ok: true
  rows: KitConsumableRow[]
}

export type NewKitConsumableInput = {
  ID_Order: number
  Date: string
  Internal_Order: string
  Material: string
  Description: string
  Quant: number
  Unit_Price: number
  Total_Price: number
}

export type KitConsumablePatch = Partial<
  Pick<
    KitConsumableRow,
    'Date' | 'Internal_Order' | 'Material' | 'Description' | 'Quant' | 'Unit_Price' | 'Total_Price'
  >
>

export type NewReconhecimentoInput = {
  ID_Order: number
  ID_Tp_Reconhecimento: string
  DT_Reconhecimento: string
  Valor_Reconhecimento: number
}

export type NewFacturacaoInput = {
  ID_Order: number
  DT_Doc_FT: string
  ID_Tp_Doc_FT: string
  N_Doc_FT: string
  Valor_Doc_FT: number
}

export type ReconhecimentoPatch = Partial<
  Pick<ReconhecimentoRow, 'ID_Tp_Reconhecimento' | 'DT_Reconhecimento' | 'Valor_Reconhecimento'>
>

export type FacturacaoPatch = Partial<
  Pick<DocumentoFaturacaoRow, 'DT_Doc_FT' | 'ID_Tp_Doc_FT' | 'N_Doc_FT' | 'Valor_Doc_FT'>
>

export type PropagateReconhecimentoInput =
  | {
      orderId: number
      kind: 'warranty'
    }
  | {
      orderId: number
      kind: 'maintenance'
      startDate: string
      years: number
      recognitionDate: string
    }

export type UtilizadorRow = {
  ID_User: string
  User_Name: string | null
  Read_Only: boolean | null
  Admin: boolean | null
  DT_Criacao: string | null
  Cancelado: boolean | null
  DT_Cancelado: string | null
  Obs: string | null
}

export type OkUtilizadores = { ok: true; users: UtilizadorRow[] }
export type OkUtilizador = { ok: true; user: UtilizadorRow }
