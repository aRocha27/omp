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
  Orc_Proposta: string | null
  PO_Cliente: string | null
  ID_Tp_Warranty: number | null
  Warranty_Reserve: number | null
  Warranty_DT_Inicio: string | null
  ID_Tp_Revenue: number | null
  Facturado: boolean | null
  Reconhecido: boolean | null
  Cod_Enc_Fornecedor: string | null
  Obs: string | null
  ID_User: string | null
  DT_User: string | null
  Kit: boolean | null
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

// Subset of dbo.[Order] columns an editor may patch. Column names mirror the SQL columns
// exactly (snake_case, uppercase) so the db layer can build the SET clause without
// translation. Every field is optional; the route enforces which fields a given role may
// touch. `user` (the acting username, written to ID_User) is added by the route, not the
// client. Keep this list in sync with UPDATEABLE_COLUMNS in db.ts.
export type OrderUpdatePatch = {
  DT_Order?: string | null
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
  'Facturado' | 'Reconhecido' | 'Negocio_Fechado'
> & {
  DT_Order: string
  ID_Tp_Order: string
  ID_Client: number
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
