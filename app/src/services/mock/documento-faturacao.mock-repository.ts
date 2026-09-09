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
import { delay } from '@/services/mock/_constants'

/** Simulated network latency for realistic loading-state behaviour (ms). */

export class MockDocumentoFaturacaoRepository implements DocumentoFaturacaoRepository {
  private readonly rows: DocumentoFaturacao[]

  constructor(private readonly store: MockDataStore = new MockDataStore()) {
    this.rows = store.facturacao
  }

  async listTypes(): Promise<DocumentoFaturacaoType[]> {
    await delay(120)
    return tpDocFts.map((option) => ({ id: String(option.id), label: option.label }))
  }

  async listByOrder(orderId: number): Promise<DocumentoFaturacao[]> {
    await delay(120)
    return this.rows
      .filter((row) => row.ID_Order === orderId)
      .sort((a, b) => {
        const da = a.DT_Doc_FT ?? ''
        const db = b.DT_Doc_FT ?? ''
        // Oldest-first so the Invoicing tab reads like a ledger.
        return da < db ? -1 : da > db ? 1 : 0
      })
      .map((row) => ({
        ...row,
        SAP_Order_Number: this.store.orders.find((order) => order.ID_Order === row.ID_Order)?.Encomenda_Cli_PHC,
        Client_Name: this.store.orders.find((order) => order.ID_Order === row.ID_Order)?.Client_Name,
        Order_Email: this.store.orders.find((order) => order.ID_Order === row.ID_Order)?.Email,
      }))
  }

  async listAll(filters: { from?: string; to?: string } = {}): Promise<DocumentoFaturacao[]> {
    await delay(120)
    return this.rows
      .filter((row) => {
        const date = row.DT_Doc_FT?.slice(0, 10) ?? ''
        return (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to)
      })
      .sort((a, b) => (a.DT_Doc_FT ?? '').localeCompare(b.DT_Doc_FT ?? ''))
      .map((row) => ({
        ...row,
        SAP_Order_Number: this.store.orders.find((order) => order.ID_Order === row.ID_Order)?.Encomenda_Cli_PHC,
        Client_Name: this.store.orders.find((order) => order.ID_Order === row.ID_Order)?.Client_Name,
        Order_Email: this.store.orders.find((order) => order.ID_Order === row.ID_Order)?.Email,
      }))
  }

  async add(entry: NewDocumentoFaturacao, role: Role): Promise<DocumentoFaturacao> {
    await delay(120)
    assertMockMutationRole(role, 'No permission to change documents.')
    const order = this.store.orders.find((row) => row.ID_Order === entry.ID_Order)
    if (!order) {
      throw new RepositoryError('not-found', 'Order not found.')
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
    await delay(120)
    assertMockMutationRole(role, 'No permission to change documents.')
    const current = this.rows.find((row) => row.ID_Facturacao === id)
    if (!current) {
      throw new RepositoryError('not-found', 'Document not found.')
    }
    const value = patch.Valor_Doc_FT ?? current.Valor_Doc_FT
    if (value === null) {
      throw new RepositoryError('server-error', 'Document value is required.')
    }
    const order = this.store.orders.find((row) => row.ID_Order === current.ID_Order)
    if (!order) {
      throw new RepositoryError('not-found', 'Order not found.')
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
    await delay(120)
    assertMockMutationRole(role, 'No permission to change documents.')
    const index = this.rows.findIndex((row) => row.ID_Facturacao === id)
    if (index === -1) {
      throw new RepositoryError('not-found', 'Document not found.')
    }
    // Hard delete — dbo.Facturacao has no deleted_at column (DB cannot change).
    this.rows.splice(index, 1)
  }
}
