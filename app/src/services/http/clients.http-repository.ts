/**
 * HTTP Clients repository.
 *
 * Live implementation of `ClientsRepository` backed by the Node API clients
 * endpoints (`POST /clients/list`, `GET /clients?id=N`). Mirrors
 * `HttpOrdersRepository`: the contract carries no credentials — the backend reads
 * through a server-configured managed profile, so the browser never sends a
 * password. Failures map to `RepositoryError` so the existing UI error states
 * render unchanged.
 */
import type { Client, ClientSearchFilters, ClientSummary } from '@/domain/models/client'
import { normaliseClientFilters } from '@/domain/models/client'
import type { RoleLike } from '@/domain/models/user'
import {
  type ClientCreateInput,
  type ClientUpdatePatch,
  type ClientsRepository,
} from '@/services/contracts/clients.repository'
import {
  getJson,
  postJson,
  postJsonWithExtraHeaders,
  unwrapApiFailure,
  type ApiFailure,
} from '@/services/http/_shared'

type SummaryRow = Omit<ClientSummary, never>
type DetailRow = Omit<Client, never>

interface OkClientsResponse {
  ok: true
  clients: SummaryRow[]
}
interface OkClientResponse {
  ok: true
  client: DetailRow | null
}
interface OkClientCreateResponse {
  ok: true
  client: DetailRow
}
interface OkClientUpdateResponse {
  ok: true
  client: DetailRow
}

const CLIENTS_FORBIDDEN_CODES = new Set(['unauthorized', 'forbidden'])
const CLIENTS_FETCH_OPTIONS = { forbiddenCodes: CLIENTS_FORBIDDEN_CODES }

export class HttpClientsRepository implements ClientsRepository {
  async search(filters: ClientSearchFilters): Promise<ClientSummary[]> {
    const body = { filters: normaliseClientFilters(filters) }
    const data = await postJson<OkClientsResponse | ApiFailure>(
      '/clients/list',
      body,
      undefined,
      CLIENTS_FETCH_OPTIONS,
    )
    return unwrapApiFailure(data).clients.map(toClientSummary)
  }

  async getById(id: number): Promise<Client | null> {
    const data = await getJson<OkClientResponse | ApiFailure>(
      `/clients?id=${id}`,
      CLIENTS_FETCH_OPTIONS,
    )
    const ok = unwrapApiFailure(data)
    return ok.client === null ? null : toClient(ok.client)
  }

  async create(input: ClientCreateInput, role: RoleLike): Promise<Client> {
    // Preserves the pre-existing lowercase `'x-user-role'` header for clients.
    const data = await postJsonWithExtraHeaders<OkClientCreateResponse | ApiFailure>(
      '/clients',
      input,
      { 'x-user-role': role },
      CLIENTS_FETCH_OPTIONS,
    )
    return toClient(unwrapApiFailure(data).client)
  }

  async update(id: number, patch: ClientUpdatePatch, role: RoleLike): Promise<Client> {
    const data = await postJsonWithExtraHeaders<OkClientUpdateResponse | ApiFailure>(
      '/clients/update',
      { id, patch },
      { 'x-user-role': role },
      CLIENTS_FETCH_OPTIONS,
    )
    return toClient(unwrapApiFailure(data).client)
  }
}

function toClientSummary(row: SummaryRow): ClientSummary {
  return {
    ID_Cliente: row.ID_Cliente,
    no_PHC: row.no_PHC,
    ID_Tp_Cliente: row.ID_Tp_Cliente,
    nome: row.nome,
    ncont: row.ncont,
    telefone: row.telefone,
    local: row.local,
  }
}

function toClient(row: DetailRow): Client {
  return {
    ID_Cliente: row.ID_Cliente,
    no_PHC: row.no_PHC,
    ID_Tp_Cliente: row.ID_Tp_Cliente,
    nome: row.nome,
    ncont: row.ncont,
    fax: row.fax,
    telefone: row.telefone,
    contacto: row.contacto,
    morada: row.morada,
    local: row.local,
    codpost: row.codpost,
    zona: row.zona,
    Defense: row.Defense,
  }
}