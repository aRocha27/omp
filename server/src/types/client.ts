/**
 * Clients wire types.
 *
 * `ClientSummaryRow` is the list projection of the client table — the columns
 * the Orders/clients pickers need to identify and disambiguate a client.
 * `ncont` (tax number) and `no_PHC` (short code) are numeric on the wire.
 * `ID_Tp_Cliente` is the raw FK; the frontend resolves the label from
 * reference data.
 */

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