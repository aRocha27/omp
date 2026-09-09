/**
 * HTTP DocumentoFaturação repository.
 *
 * Live read/write implementation of `DocumentoFaturacaoRepository` backed by the
 * Node API. Document type options come from the runtime `dbo.Tp_Doc_FT` lookup;
 * mutations are revalidated transactionally by the server. Failures map to
 * `RepositoryError` so the order-detail Faturação tab handles mock and live failures
 * consistently.
 */
import type { DocumentoFaturacao } from '@/domain/models/documento-faturacao'
import {
  type DocumentoFaturacaoPatch,
  type DocumentoFaturacaoRepository,
  type DocumentoFaturacaoType,
  type NewDocumentoFaturacao,
} from '@/services/contracts/documento-faturacao.repository'
import type { Role } from '@/domain/models/user'
import {
  getJson,
  postJson,
  unwrapApiFailure,
  type ApiFailure,
} from '@/services/http/_shared'

type Row = DocumentoFaturacao

interface OkTypesResponse {
  ok: true
  types: DocumentoFaturacaoType[]
}
interface OkRowsResponse {
  ok: true
  rows: Row[]
}

const DOCUMENTO_FATURACAO_FORBIDDEN_CODES = new Set(['unauthorized', 'forbidden', 'field-locked'])
const DOCUMENTO_FATURACAO_FETCH_OPTIONS = { forbiddenCodes: DOCUMENTO_FATURACAO_FORBIDDEN_CODES }

export class HttpDocumentoFaturacaoRepository implements DocumentoFaturacaoRepository {
  async listTypes(): Promise<DocumentoFaturacaoType[]> {
    const data = await getJson<OkTypesResponse | ApiFailure>(
      '/orders/facturacao/types',
      DOCUMENTO_FATURACAO_FETCH_OPTIONS,
    )
    return unwrapApiFailure(data).types.map((type) => ({ ...type }))
  }

  async listByOrder(orderId: number): Promise<DocumentoFaturacao[]> {
    const data = await getJson<OkRowsResponse | ApiFailure>(
      `/orders/facturacao?orderId=${orderId}`,
      DOCUMENTO_FATURACAO_FETCH_OPTIONS,
    )
    return unwrapApiFailure(data).rows.map(toDocumentoFaturacao)
  }

  async listAll(filters: { from?: string; to?: string } = {}): Promise<DocumentoFaturacao[]> {
    const params = new URLSearchParams()
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    const data = await getJson<OkRowsResponse | ApiFailure>(
      `/orders/facturacao/all?${params.toString()}`,
      DOCUMENTO_FATURACAO_FETCH_OPTIONS,
    )
    return unwrapApiFailure(data).rows.map(toDocumentoFaturacao)
  }

  async add(entry: NewDocumentoFaturacao, role: Role): Promise<DocumentoFaturacao> {
    const data = await postJson<{ ok: true; row: Row } | ApiFailure>(
      '/orders/facturacao',
      entry,
      role,
      DOCUMENTO_FATURACAO_FETCH_OPTIONS,
    )
    return toDocumentoFaturacao(unwrapApiFailure(data).row)
  }

  async update(
    id: number,
    patch: DocumentoFaturacaoPatch,
    role: Role,
  ): Promise<DocumentoFaturacao> {
    const data = await postJson<{ ok: true; row: Row } | ApiFailure>(
      '/orders/facturacao/update',
      { id, patch },
      role,
      DOCUMENTO_FATURACAO_FETCH_OPTIONS,
    )
    return toDocumentoFaturacao(unwrapApiFailure(data).row)
  }

  async remove(id: number, role: Role): Promise<void> {
    const data = await postJson<{ ok: true } | ApiFailure>(
      '/orders/facturacao/delete',
      { id },
      role,
      DOCUMENTO_FATURACAO_FETCH_OPTIONS,
    )
    unwrapApiFailure(data)
  }
}

function toDocumentoFaturacao(row: Row): DocumentoFaturacao {
  // The backend row already matches the model shape (upsize_ts stripped,
  // datetimes as ISO strings). Copy to avoid leaking the wire object identity.
  return { ...row }
}
