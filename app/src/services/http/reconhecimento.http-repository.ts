/**
 * HTTP Reconhecimento repository.
 *
 * Live read implementation of `ReconhecimentoRepository` backed by the Node API
 * sub-table endpoint `GET /orders/reconhecimentos?orderId=N`. The contract carries
 * no credentials — the backend reads through a server-configured managed profile.
 * Failures map to `RepositoryError` so the order-detail Revenue tab renders
 * unchanged.
 *
 * `add` is NOT supported live (the `[+ Reconhecimento]` action is gated to mock
 * mode); live sub-table write is a flagged follow-up.
 */
import { env } from '@/app/configuration/env'
import type { Reconhecimento } from '@/domain/models/reconhecimento'
import {
  RepositoryError,
  type NewReconhecimento,
  type ReconhecimentoRepository,
} from '@/services/contracts/reconhecimento.repository'

type Row = Reconhecimento

interface OkRowsResponse {
  ok: true
  rows: Row[]
}
interface ApiFailure {
  ok: false
  code: string
  message: string
}

export class HttpReconhecimentoRepository implements ReconhecimentoRepository {
  async listByOrder(orderId: number): Promise<Reconhecimento[]> {
    const data = await getJson<OkRowsResponse | ApiFailure>(
      `/orders/reconhecimentos?orderId=${orderId}`,
    )
    if (!data.ok) throw toRepositoryError(data, 404)
    return data.rows.map(toReconhecimento)
  }

  async add(entry: NewReconhecimento, role = 'editor'): Promise<Reconhecimento> {
    const data = await postJson<{ ok: true; row: Row } | ApiFailure>('/orders/reconhecimentos', entry, role)
    if (!data.ok) throw toRepositoryError(data, 422)
    return toReconhecimento(data.row)
  }
}

function toReconhecimento(row: Row): Reconhecimento {
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
