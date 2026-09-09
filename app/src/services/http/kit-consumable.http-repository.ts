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
import type { KitConsumable } from '@/domain/models/kit-consumable'
import {
  type KitConsumablePatch,
  type KitConsumableRepository,
  type NewKitConsumable,
} from '@/services/contracts/kit-consumable.repository'
import type { Role } from '@/domain/models/user'
import {
  getJson,
  postJson,
  unwrapApiFailure,
  type ApiFailure,
} from '@/services/http/_shared'

type Row = KitConsumable

interface OkRowsResponse {
  ok: true
  rows: Row[]
}

const KIT_CONSUMABLE_FORBIDDEN_CODES = new Set(['unauthorized', 'forbidden', 'field-locked'])
const KIT_CONSUMABLE_FETCH_OPTIONS = { forbiddenCodes: KIT_CONSUMABLE_FORBIDDEN_CODES }

export class HttpKitConsumableRepository implements KitConsumableRepository {
  async listByOrder(orderId: number): Promise<KitConsumable[]> {
    const data = await getJson<OkRowsResponse | ApiFailure>(
      `/orders/kit-consumables?orderId=${orderId}`,
      KIT_CONSUMABLE_FETCH_OPTIONS,
    )
    return unwrapApiFailure(data).rows.map(toKitConsumable)
  }

  async add(entry: NewKitConsumable, role: Role): Promise<KitConsumable> {
    const data = await postJson<{ ok: true; row: Row } | ApiFailure>(
      '/orders/kit-consumables',
      entry,
      role,
      KIT_CONSUMABLE_FETCH_OPTIONS,
    )
    return toKitConsumable(unwrapApiFailure(data).row)
  }

  async update(id: number, patch: KitConsumablePatch, role: Role): Promise<KitConsumable> {
    const data = await postJson<{ ok: true; row: Row } | ApiFailure>(
      '/orders/kit-consumables/update',
      { id, patch },
      role,
      KIT_CONSUMABLE_FETCH_OPTIONS,
    )
    return toKitConsumable(unwrapApiFailure(data).row)
  }

  async remove(id: number, role: Role): Promise<void> {
    const data = await postJson<{ ok: true } | ApiFailure>(
      '/orders/kit-consumables/delete',
      { id },
      role,
      KIT_CONSUMABLE_FETCH_OPTIONS,
    )
    unwrapApiFailure(data)
  }
}

function toKitConsumable(row: Row): KitConsumable {
  // The backend row already matches the model shape (datetimes as ISO strings).
  // Copy to avoid leaking the wire object identity.
  return { ...row }
}