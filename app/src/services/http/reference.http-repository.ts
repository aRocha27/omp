/**
 * HTTP reference-cascade repository.
 *
 * Live implementation of `ReferenceRepository` backed by the Node API read-only
 * reference endpoints (`GET /areas`, `GET /produtos?area=`, `GET /instrumentos?produto=`).
 * Mirrors `HttpClientsRepository`: the contract carries no credentials — the backend
 * reads through a server-configured managed profile, so the browser never sends a
 * password. Failures map to `RepositoryError` so the UI error states render unchanged.
 */
import { env } from '@/app/configuration/env'
import type {
  AreaOption,
  InstrumentoOption,
  ProdutoOption,
} from '@/domain/models/reference-cascade'
import {
  RepositoryError,
  type ReferenceRepository,
} from '@/services/contracts/reference.repository'

interface OkAreasResponse {
  ok: true
  areas: AreaOption[]
}
interface OkProdutosResponse {
  ok: true
  produtos: ProdutoOption[]
}
interface OkInstrumentosResponse {
  ok: true
  instrumentos: InstrumentoOption[]
}
interface ApiFailure {
  ok: false
  code: string
  message: string
}

export class HttpReferenceRepository implements ReferenceRepository {
  async listAreas(): Promise<AreaOption[]> {
    const data = await getJson<OkAreasResponse | ApiFailure>('/areas')
    if (!data.ok) throw toRepositoryError(data)
    return data.areas
  }

  async listProdutos(area?: string): Promise<ProdutoOption[]> {
    const path = area ? `/produtos?area=${encodeURIComponent(area)}` : '/produtos'
    const data = await getJson<OkProdutosResponse | ApiFailure>(path)
    if (!data.ok) throw toRepositoryError(data)
    return data.produtos
  }

  async listInstrumentos(produto?: number): Promise<InstrumentoOption[]> {
    const path = produto != null ? `/instrumentos?produto=${produto}` : '/instrumentos'
    const data = await getJson<OkInstrumentosResponse | ApiFailure>(path)
    if (!data.ok) throw toRepositoryError(data)
    return data.instrumentos
  }
}

function toRepositoryError(failure: ApiFailure): RepositoryError {
  const message = failure.message || 'The database service returned an error.'
  if (failure.code === 'unauthorized' || failure.code === 'forbidden') {
    return new RepositoryError('forbidden', message)
  }
  return new RepositoryError('server-error', message)
}

async function getJson<T>(path: string): Promise<T> {
  let response: Response
  try {
    response = await fetch(apiUrl(path), { method: 'GET' })
  } catch {
    throw new RepositoryError('server-error', "Couldn't reach the database service.")
  }

  const data = (await response.json().catch(() => null)) as T | ApiFailure | null
  if (!response.ok) {
    const failure = isApiFailure(data)
      ? data
      : { ok: false as const, code: 'unknown', message: 'The database service returned an unexpected error.' }
    throw toRepositoryError(failure)
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