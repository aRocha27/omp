/**
 * HTTP DocumentoFaturação repository.
 *
 * Live read implementation of `DocumentoFaturacaoRepository` backed by the Node
 * API sub-table endpoint `GET /orders/facturacao?orderId=N`. Failures map to
 * `RepositoryError` so the order-detail Faturação tab renders unchanged.
 *
 * `add` is NOT supported live; live sub-table write is a flagged follow-up.
 */
import { env } from '@/app/configuration/env'
import type { DocumentoFaturacao } from '@/domain/models/documento-faturacao'
import {
  RepositoryError,
  type DocumentoFaturacaoRepository,
  type NewDocumentoFaturacao,
} from '@/services/contracts/documento-faturacao.repository'

type Row = DocumentoFaturacao

interface OkRowsResponse {
  ok: true
  rows: Row[]
}
interface ApiFailure {
  ok: false
  code: string
  message: string
}

export class HttpDocumentoFaturacaoRepository implements DocumentoFaturacaoRepository {
  async listByOrder(orderId: number): Promise<DocumentoFaturacao[]> {
    const data = await getJson<OkRowsResponse | ApiFailure>(
      `/orders/facturacao?orderId=${orderId}`,
    )
    if (!data.ok) throw toRepositoryError(data, 404)
    return data.rows.map(toDocumentoFaturacao)
  }

  async add(entry: NewDocumentoFaturacao, role = 'editor'): Promise<DocumentoFaturacao> {
    const data = await postJson<{ ok: true; row: Row } | ApiFailure>('/orders/facturacao', entry, role)
    if (!data.ok) throw toRepositoryError(data, 422)
    return toDocumentoFaturacao(data.row)
  }
}

function toDocumentoFaturacao(row: Row): DocumentoFaturacao {
  // The backend row already matches the model shape (upsize_ts stripped,
  // datetimes as ISO strings). Copy to avoid leaking the wire object identity.
  return { ...row }
}

function toRepositoryError(failure: ApiFailure, notFoundStatus: number): RepositoryError {
  const message = failure.message || 'The database service returned an error.'
  if (failure.code === 'unauthorized' || failure.code === 'forbidden' || failure.code === 'field-locked') {
    return new RepositoryError('forbidden', message)
  }
  if (notFoundStatus === 404) return new RepositoryError('not-found', message)
  return new RepositoryError('server-error', message)
}

async function getJson<T>(path: string): Promise<T> {
  return requestJson<T>(path, { method: 'GET' })
}

async function postJson<T>(path: string, body: unknown, role: string): Promise<T> {
  return requestJson<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Role': role },
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
