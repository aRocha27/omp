/**
 * HTTP reference-cascade repository.
 *
 * Live implementation of `ReferenceRepository` backed by the Node API read-only
 * reference endpoints (`GET /areas`, `GET /produtos?area=`, `GET /instrumentos?produto=`).
 * Mirrors `HttpClientsRepository`: the contract carries no credentials — the backend
 * reads through a server-configured managed profile, so the browser never sends a
 * password. Failures map to `RepositoryError` so the UI error states render unchanged.
 */
import type {
  AreaOption,
  InstrumentoOption,
  ProdutoOption,
} from '@/domain/models/reference-cascade'
import type { ReferenceRepository } from '@/services/contracts/reference.repository'
import {
  getJsonReadOnly,
  toRepositoryErrorReadOnly,
  type ApiFailure,
} from '@/services/http/_shared'

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

export class HttpReferenceRepository implements ReferenceRepository {
  async listAreas(): Promise<AreaOption[]> {
    const data = await getJsonReadOnly<OkAreasResponse | ApiFailure>('/areas')
    if (!data.ok) throw toRepositoryErrorReadOnly(data)
    return data.areas
  }

  async listProdutos(area?: string): Promise<ProdutoOption[]> {
    const path = area ? `/produtos?area=${encodeURIComponent(area)}` : '/produtos'
    const data = await getJsonReadOnly<OkProdutosResponse | ApiFailure>(path)
    if (!data.ok) throw toRepositoryErrorReadOnly(data)
    return data.produtos
  }

  async listInstrumentos(produto?: number): Promise<InstrumentoOption[]> {
    const path = produto != null ? `/instrumentos?produto=${produto}` : '/instrumentos'
    const data = await getJsonReadOnly<OkInstrumentosResponse | ApiFailure>(path)
    if (!data.ok) throw toRepositoryErrorReadOnly(data)
    return data.instrumentos
  }
}