/**
 * HTTP Kit_Consumables repository.
 *
 * Live read/write implementation of `KitConsumableRepository` backed by the Node
 * API. The contract carries no database credentials — the backend uses a
 * server-configured managed profile and independently enforces roles. Failures
 * map to `RepositoryError` so the order-detail Kit tab handles mock and live
 * failures consistently. Mirrors `HttpReconhecimentoRepository` minus
 * `propagate`, which Kit_Consumables lacks.
 */
import { env } from '@/app/configuration/env'
import type { KitConsumable } from '@/domain/models/kit-consumable'
import {
  RepositoryError,
  type KitConsumablePatch,
  type KitConsumableRepository,
  type NewKitConsumable,
} from '@/services/contracts/kit-consumable.repository'
import type { Role } from '@/domain/models/user'

type Row = KitConsumable

interface OkRowsResponse {
  ok: true
  rows: Row[]
}
interface ApiFailure {
  ok: false
  code: string
  message: string
}

export class HttpKitConsumableRepository implements KitConsumableRepository {
  async listByOrder(orderId: number): Promise<KitConsumable[]> {
    const data = await getJson<OkRowsResponse | ApiFailure>(
      `/orders/kit-consumables?orderId=${orderId}`,
    )
    if (!data.ok) throw toRepositoryError(data, 404)
    return data.rows.map(toKitConsumable)
  }

  async add(entry: NewKitConsumable, role: Role): Promise<KitConsumable> {
    const data = await postJson<{ ok: true; row: Row } | ApiFailure>(
      '/orders/kit-consumables',
      entry,
      role,
    )
    if (!data.ok) throw toRepositoryError(data, 422)
    return toKitConsumable(data.row)
  }

  async update(id: number, patch: KitConsumablePatch, role: Role): Promise<KitConsumable> {
    const data = await postJson<{ ok: true; row: Row } | ApiFailure>(
      '/orders/kit-consumables/update',
      { id, patch },
      role,
    )
    if (!data.ok) throw toRepositoryError(data, 422)
    return toKitConsumable(data.row)
  }

  async remove(id: number, role: Role): Promise<void> {
    const data = await postJson<{ ok: true } | ApiFailure>(
      '/orders/kit-consumables/delete',
      { id },
      role,
    )
    if (!data.ok) throw toRepositoryError(data, 422)
  }
}

function toKitConsumable(row: Row): KitConsumable {
  // The backend row already matches the model shape (datetimes as ISO strings).
  // Copy to avoid leaking the wire object identity.
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