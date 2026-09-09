/**
 * HTTP Reconhecimento repository.
 *
 * Live read/write implementation of `ReconhecimentoRepository` backed by the Node
 * API. The contract carries no database credentials — the backend uses a
 * server-configured managed profile and independently enforces roles, capacity, and
 * transaction boundaries. Failures map to `RepositoryError` so the order-detail
 * Revenue tab handles mock and live failures consistently.
 */
import type { Reconhecimento } from '@/domain/models/reconhecimento'
import {
  type NewReconhecimento,
  type PropagateReconhecimentoInput,
  type ReconhecimentoPatch,
  type ReconhecimentoRepository,
} from '@/services/contracts/reconhecimento.repository'
import type { Role } from '@/domain/models/user'
import {
  getJson,
  postJson,
  unwrapApiFailure,
  type ApiFailure,
} from '@/services/http/_shared'

type Row = Reconhecimento

interface OkRowsResponse {
  ok: true
  rows: Row[]
}

const RECONHECIMENTO_FORBIDDEN_CODES = new Set(['unauthorized', 'forbidden', 'field-locked'])
const RECONHECIMENTO_FETCH_OPTIONS = { forbiddenCodes: RECONHECIMENTO_FORBIDDEN_CODES }

export class HttpReconhecimentoRepository implements ReconhecimentoRepository {
  async listByOrder(orderId: number): Promise<Reconhecimento[]> {
    const data = await getJson<OkRowsResponse | ApiFailure>(
      `/orders/reconhecimentos?orderId=${orderId}`,
      RECONHECIMENTO_FETCH_OPTIONS,
    )
    return unwrapApiFailure(data).rows.map(toReconhecimento)
  }

  async add(entry: NewReconhecimento, role: Role): Promise<Reconhecimento> {
    const data = await postJson<{ ok: true; row: Row } | ApiFailure>(
      '/orders/reconhecimentos',
      entry,
      role,
      RECONHECIMENTO_FETCH_OPTIONS,
    )
    return toReconhecimento(unwrapApiFailure(data).row)
  }

  async update(id: number, patch: ReconhecimentoPatch, role: Role): Promise<Reconhecimento> {
    const data = await postJson<{ ok: true; row: Row } | ApiFailure>(
      '/orders/reconhecimentos/update',
      { id, patch },
      role,
      RECONHECIMENTO_FETCH_OPTIONS,
    )
    return toReconhecimento(unwrapApiFailure(data).row)
  }

  async remove(id: number, role: Role): Promise<void> {
    const data = await postJson<{ ok: true } | ApiFailure>(
      '/orders/reconhecimentos/delete',
      { id },
      role,
      RECONHECIMENTO_FETCH_OPTIONS,
    )
    unwrapApiFailure(data)
  }

  async propagate(
    orderId: number,
    input: PropagateReconhecimentoInput,
    role: Role,
  ): Promise<Reconhecimento[]> {
    const data = await postJson<{ ok: true; rows: Row[] } | ApiFailure>(
      '/orders/reconhecimentos/propagate',
      { orderId, ...input },
      role,
      RECONHECIMENTO_FETCH_OPTIONS,
    )
    return unwrapApiFailure(data).rows.map(toReconhecimento)
  }
}

function toReconhecimento(row: Row): Reconhecimento {
  // The backend row already matches the model shape (upsize_ts stripped,
  // datetimes as ISO strings). Copy to avoid leaking the wire object identity.
  return { ...row }
}