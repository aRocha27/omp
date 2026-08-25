/**
 * Mock DocumentoFaturacao repository.
 *
 * Deterministic, in-memory implementation of `DocumentoFaturacaoRepository` backed
 * by synthetic fixtures. May simulate latency but must not invent business rules
 * (docs/architecture/ARCHITECTURE.md §4, MOCK_DATA_CONTRACT.md §5).
 *
 * A mutable copy of the fixture array is kept so `add` persists for the session
 * without mutating the imported `readonly` fixture export.
 */
import type { DocumentoFaturacao } from '@/domain/models/documento-faturacao'
import type { Role } from '@/domain/models/user'
import type {
  DocumentoFaturacaoPatch,
  DocumentoFaturacaoType,
  DocumentoFaturacaoRepository,
  NewDocumentoFaturacao,
} from '@/services/contracts/documento-faturacao.repository'
import { RepositoryError } from '@/services/contracts/orders.repository'
import { tpDocFts } from '@/fixtures/reference-data'
import { MockDataStore } from '@/services/mock/mock-data-store'
import { assertMockMutationRole } from '@/services/mock/mock-authorization'
import { assertNetInvoicingCapacity } from '@/services/mock/mock-capacity'

/** Simulated network latency for realistic loading-state behaviour (ms). */
const MOCK_LATENCY_MS = 120

export class MockDocumentoFaturacaoRepository implements DocumentoFaturacaoRepository {
  private readonly rows: DocumentoFaturacao[]

  constructor(private readonly store: MockDataStore = new MockDataStore()) {
    this.rows = store.facturacao
  }

  async listTypes(): Promise<DocumentoFaturacaoType[]> {
    await delay(MOCK_LATENCY_MS)
    return tpDocFts.map((option) => ({ id: String(option.id), label: option.label }))
  }

  async listByOrder(orderId: number): Promise<DocumentoFaturacao[]> {
    await delay(MOCK_LATENCY_MS)
    return this.rows
      .filter((row) => row.ID_Order === orderId)
      .sort((a, b) => {
        const da = a.DT_Doc_FT ?? ''
        const db = b.DT_Doc_FT ?? ''
        // Oldest-first so the Invoicing tab reads like a ledger.
        return da < db ? -1 : da > db ? 1 : 0
      })
      .map((row) => ({ ...row }))
  }

  async add(entry: NewDocumentoFaturacao, role: Role): Promise<DocumentoFaturacao> {
    await delay(MOCK_LATENCY_MS)
    assertMockMutationRole(role, 'Sem permissão para alterar documentos.')
    const order = this.store.orders.find((row) => row.ID_Order === entry.ID_Order)
    if (!order) {
      throw new RepositoryError('not-found', 'Pedido não encontrado.')
    }
    assertNetInvoicingCapacity(
      order,
      this.rows.filter((row) => row.ID_Order === entry.ID_Order),
      entry.Valor_Doc_FT,
    )
    const created: DocumentoFaturacao = {
      ...entry,
      ID_Facturacao: this.store.allocateFacturacaoId(),
      ID_User: entry.ID_User ?? 'mock',
      DT_User: new Date().toISOString(),
    }
    this.rows.push(created)
    return { ...created }
  }

  async update(
    id: number,
    patch: DocumentoFaturacaoPatch,
    role: Role,
  ): Promise<DocumentoFaturacao> {
    await delay(MOCK_LATENCY_MS)
    assertMockMutationRole(role, 'Sem permissão para alterar documentos.')
    const current = this.rows.find((row) => row.ID_Facturacao === id)
    if (!current) {
      throw new RepositoryError('not-found', 'Documento não encontrado.')
    }
    const value = patch.Valor_Doc_FT ?? current.Valor_Doc_FT
    if (value === null) {
      throw new RepositoryError('server-error', 'O valor do documento é obrigatório.')
    }
    const order = this.store.orders.find((row) => row.ID_Order === current.ID_Order)
    if (!order) {
      throw new RepositoryError('not-found', 'Pedido não encontrado.')
    }
    assertNetInvoicingCapacity(
      order,
      this.rows.filter((row) => row.ID_Order === current.ID_Order && row.ID_Facturacao !== id),
      value,
    )
    Object.assign(current, patch, {
      ID_User: 'mock',
      DT_User: new Date().toISOString(),
    })
    return { ...current }
  }

  async remove(id: number, role: Role): Promise<void> {
    await delay(MOCK_LATENCY_MS)
    assertMockMutationRole(role, 'Sem permissão para alterar documentos.')
    const index = this.rows.findIndex((row) => row.ID_Facturacao === id)
    if (index === -1) {
      throw new RepositoryError('not-found', 'Documento não encontrado.')
    }
    // Hard delete — dbo.Facturacao has no deleted_at column (DB cannot change).
    this.rows.splice(index, 1)
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
