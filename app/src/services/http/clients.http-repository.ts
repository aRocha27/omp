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
import { env } from '@/app/configuration/env'
import type { Client, ClientSearchFilters, ClientSummary } from '@/domain/models/client'
import { normaliseClientFilters } from '@/domain/models/client'
import type { RoleLike } from '@/domain/models/user'
import {
  RepositoryError,
  type ClientCreateInput,
  type ClientUpdatePatch,
  type ClientsRepository,
} from '@/services/contracts/clients.repository'

const LIST_LIMIT = 200

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
interface ApiFailure {
  ok: false
  code: string
  message: string
}

export class HttpClientsRepository implements ClientsRepository {
  async search(filters: ClientSearchFilters): Promise<ClientSummary[]> {
    const body = { filters: normaliseClientFilters(filters), limit: LIST_LIMIT }
    const data = await postJson<OkClientsResponse | ApiFailure>('/clients/list', body)
    if (!data.ok) throw toRepositoryError(data, 502)
    return data.clients.map(toClientSummary)
  }

  async getById(id: number): Promise<Client | null> {
    const data = await getJson<OkClientResponse | ApiFailure>(`/clients?id=${id}`)
    if (!data.ok) throw toRepositoryError(data, 404)
    return data.client === null ? null : toClient(data.client)
  }

  async create(input: ClientCreateInput, role: RoleLike): Promise<Client> {
    const data = await postJson<OkClientCreateResponse | ApiFailure>(
      '/clients',
      input,
      role,
    )
    if (!data.ok) throw toRepositoryError(data, 400)
    return toClient(data.client)
  }

  async update(id: number, patch: ClientUpdatePatch, role: RoleLike): Promise<Client> {
    const data = await postJson<OkClientUpdateResponse | ApiFailure>(
      '/clients/update',
      { id, patch },
      role,
    )
    if (!data.ok) throw toRepositoryError(data, 404)
    return toClient(data.client)
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

function toRepositoryError(failure: ApiFailure, notFoundStatus: number): RepositoryError {
  const message = failure.message || 'The database service returned an error.'
  // Same mapping as orders: authz failures (401/403) collapse to `forbidden`; the
  // list endpoint never 404s, so `notFoundStatus` is only meaningful for getById.
  if (failure.code === 'unauthorized' || failure.code === 'forbidden') {
    return new RepositoryError('forbidden', message)
  }
  // `clients-not-configured` (502) and any other failure surface as server-error.
  if (notFoundStatus === 404) return new RepositoryError('not-found', message)
  return new RepositoryError('server-error', message)
}

async function getJson<T>(path: string): Promise<T> {
  return requestJson<T>(path, { method: 'GET' })
}

async function postJson<T>(path: string, body: unknown, role?: RoleLike): Promise<T> {
  return requestJson<T>(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(role ? { 'x-user-role': role } : {}),
    },
    body: JSON.stringify(body),
  })
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(apiUrl(path), init)
  } catch {
    throw new RepositoryError('server-error', "Couldn't reach the database service.")
  }

  const data = (await response.json().catch(() => null)) as T | ApiFailure | null
  if (!response.ok) {
    const failure = isApiFailure(data)
      ? data
      : { ok: false as const, code: 'unknown', message: 'The database service returned an unexpected error.' }
    throw toRepositoryError(failure, response.status)
  }
  return data as T
}

function isApiFailure(value: unknown): value is ApiFailure {
  if (typeof value !== 'object' || value === null) return false
  return (value as ApiFailure).ok === false
}

function apiUrl(path: string): string {
  return `${env.apiBaseUrl.replace(/\/$/, '')}${path}`
}