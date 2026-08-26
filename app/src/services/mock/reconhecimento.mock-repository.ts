/**
 * Mock Reconhecimento repository.
 *
 * Deterministic, in-memory implementation of `ReconhecimentoRepository` backed by
 * synthetic fixtures. May simulate latency but must not invent business rules
 * (docs/architecture/ARCHITECTURE.md §4, MOCK_DATA_CONTRACT.md §5).
 *
 * A mutable copy of the fixture array is kept so `add`/`update`/`remove`/`propagate`
 * persist for the session without mutating the imported `readonly` fixture export.
 */
import type { Reconhecimento } from '@/domain/models/reconhecimento'
import type { Role } from '@/domain/models/user'
import type {
  NewReconhecimento,
  PropagateReconhecimentoInput,
  ReconhecimentoPatch,
  ReconhecimentoRepository,
} from '@/services/contracts/reconhecimento.repository'
import { RepositoryError } from '@/services/contracts/orders.repository'
import { MockDataStore } from '@/services/mock/mock-data-store'
import { assertMockMutationRole } from '@/services/mock/mock-authorization'
import { assertRecognitionCapacity } from '@/services/mock/mock-capacity'
import { planMaintenancePropagation, planWarrantyPropagation } from '@/domain/rules/propagation'

/** Simulated network latency for realistic loading-state behaviour (ms). */
const MOCK_LATENCY_MS = 120

export class MockReconhecimentoRepository implements ReconhecimentoRepository {
  private readonly rows: Reconhecimento[]

  constructor(private readonly store: MockDataStore = new MockDataStore()) {
    this.rows = store.reconhecimentos
  }

  async listByOrder(orderId: number): Promise<Reconhecimento[]> {
    await delay(MOCK_LATENCY_MS)
    return this.rows
      .filter((row) => row.ID_Order === orderId)
      .sort((a, b) => {
        const da = a.DT_Reconhecimento ?? ''
        const db = b.DT_Reconhecimento ?? ''
        // Oldest-first so the Revenue tab reads like a ledger.
        return da < db ? -1 : da > db ? 1 : 0
      })
      .map((row) => ({ ...row }))
  }

  async add(entry: NewReconhecimento, role: Role): Promise<Reconhecimento> {
    await delay(MOCK_LATENCY_MS)
    assertMockMutationRole(role, 'No permission to change recognitions.')
    const order = this.store.orders.find((row) => row.ID_Order === entry.ID_Order)
    if (!order) {
      throw new RepositoryError('not-found', 'Order not found.')
    }
    assertRecognitionCapacity(
      order,
      this.rows.filter((row) => row.ID_Order === entry.ID_Order),
      entry.ID_Tp_Reconhecimento,
      entry.Valor_Reconhecimento,
    )
    const created: Reconhecimento = {
      ...entry,
      ID_Reconhecimento: this.store.allocateReconhecimentoId(),
      ID_User: entry.ID_User ?? 'mock',
      DT_User: new Date().toISOString(),
    }
    this.rows.push(created)
    return { ...created }
  }

  async update(id: number, patch: ReconhecimentoPatch, role: Role): Promise<Reconhecimento> {
    await delay(MOCK_LATENCY_MS)
    assertMockMutationRole(role, 'No permission to change recognitions.')
    const current = this.rows.find((row) => row.ID_Reconhecimento === id)
    if (!current) {
      throw new RepositoryError('not-found', 'Recognition not found.')
    }
    const order = this.store.orders.find((row) => row.ID_Order === current.ID_Order)
    if (!order) {
      throw new RepositoryError('not-found', 'Order not found.')
    }
    const candidate = { ...current, ...patch }
    if (candidate.ID_Tp_Reconhecimento === null || candidate.Valor_Reconhecimento === null) {
      throw new RepositoryError('server-error', 'Recognition type and value are required.')
    }
    assertRecognitionCapacity(
      order,
      this.rows.filter((row) => row.ID_Order === current.ID_Order && row.ID_Reconhecimento !== id),
      candidate.ID_Tp_Reconhecimento,
      candidate.Valor_Reconhecimento,
    )
    Object.assign(current, patch, {
      ID_User: 'mock',
      DT_User: new Date().toISOString(),
    })
    return { ...current }
  }

  async remove(id: number, role: Role): Promise<void> {
    await delay(MOCK_LATENCY_MS)
    assertMockMutationRole(role, 'No permission to change recognitions.')
    const index = this.rows.findIndex((row) => row.ID_Reconhecimento === id)
    if (index === -1) {
      throw new RepositoryError('not-found', 'Recognition not found.')
    }
    // Hard delete — dbo.Reconhecimento has no deleted_at column (DB cannot change).
    this.rows.splice(index, 1)
  }

  async propagate(
    orderId: number,
    input: PropagateReconhecimentoInput,
    role: Role,
  ): Promise<Reconhecimento[]> {
    await delay(MOCK_LATENCY_MS)
    assertMockMutationRole(role, 'No permission to change recognitions.')
    const order = this.store.orders.find((row) => row.ID_Order === orderId)
    if (!order) {
      throw new RepositoryError('not-found', 'Order not found.')
    }

    const lines =
      input.kind === 'warranty'
        ? planWarrantyPropagation(order)
        : planMaintenancePropagation(
            order,
            input.startDate,
            input.years,
            input.recognitionDate,
          )
    const existing = this.rows.filter((row) => row.ID_Order === orderId)
    const plannedTotal = lines.reduce((sum, line) => sum + line.value, 0)
    if (lines.length > 0) {
      assertRecognitionCapacity(order, existing, lines[0].type, plannedTotal)
    }
    const created = lines.map<Reconhecimento>((line) => ({
      ID_Reconhecimento: this.store.allocateReconhecimentoId(),
      ID_Order: orderId,
      ID_Tp_Reconhecimento: line.type,
      DT_Reconhecimento: line.date,
      Valor_Reconhecimento: line.value,
      ID_User: 'mock',
      DT_User: new Date().toISOString(),
    }))
    this.rows.push(...created)
    return created.map((row) => ({ ...row }))
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
