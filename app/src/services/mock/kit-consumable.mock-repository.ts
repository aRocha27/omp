/**
 * Mock Kit_Consumables repository.
 *
 * Deterministic, in-memory implementation of `KitConsumableRepository` backed by
 * synthetic fixtures. May simulate latency but must not invent business rules
 * (docs/architecture/ARCHITECTURE.md §4, MOCK_DATA_CONTRACT.md §5).
 *
 * Unlike Reconhecimento/Facturacao, dbo.Kit_Consumables has no ID_User/DT_User
 * audit columns and no capacity constraint — the Saldo (Kit_Amount − Σ
 * Total_Price) is display-only — so this repository performs plain
 * insert/update/hard-delete with role gating only.
 *
 * A mutable copy of the fixture array is kept so mutations persist for the
 * session without mutating the imported `readonly` fixture export.
 */
import type { KitConsumable } from '@/domain/models/kit-consumable'
import type { Role } from '@/domain/models/user'
import type {
  KitConsumablePatch,
  KitConsumableRepository,
  NewKitConsumable,
} from '@/services/contracts/kit-consumable.repository'
import { RepositoryError } from '@/services/contracts/orders.repository'
import { MockDataStore } from '@/services/mock/mock-data-store'
import { assertMockMutationRole } from '@/services/mock/mock-authorization'

/** Simulated network latency for realistic loading-state behaviour (ms). */
const MOCK_LATENCY_MS = 120

export class MockKitConsumableRepository implements KitConsumableRepository {
  private readonly rows: KitConsumable[]

  constructor(private readonly store: MockDataStore = new MockDataStore()) {
    this.rows = store.kitConsumables
  }

  async listByOrder(orderId: number): Promise<KitConsumable[]> {
    await delay(MOCK_LATENCY_MS)
    return this.rows
      .filter((row) => row.ID_Order === orderId)
      .sort((a, b) => a.ID_Kit - b.ID_Kit)
      .map((row) => ({ ...row }))
  }

  async add(entry: NewKitConsumable, role: Role): Promise<KitConsumable> {
    await delay(MOCK_LATENCY_MS)
    assertMockMutationRole(role, 'No permission to change kit consumables.')
    const order = this.store.orders.find((row) => row.ID_Order === entry.ID_Order)
    if (!order) {
      throw new RepositoryError('not-found', 'Order not found.')
    }
    const created: KitConsumable = {
      ID_Kit: this.store.allocateKitConsumableId(),
      ...entry,
    }
    this.rows.push(created)
    return { ...created }
  }

  async update(id: number, patch: KitConsumablePatch, role: Role): Promise<KitConsumable> {
    await delay(MOCK_LATENCY_MS)
    assertMockMutationRole(role, 'No permission to change kit consumables.')
    const current = this.rows.find((row) => row.ID_Kit === id)
    if (!current) {
      throw new RepositoryError('not-found', 'Kit consumable not found.')
    }
    Object.assign(current, patch)
    return { ...current }
  }

  async remove(id: number, role: Role): Promise<void> {
    await delay(MOCK_LATENCY_MS)
    assertMockMutationRole(role, 'No permission to change kit consumables.')
    const index = this.rows.findIndex((row) => row.ID_Kit === id)
    if (index === -1) {
      throw new RepositoryError('not-found', 'Kit consumable not found.')
    }
    // Hard delete — dbo.Kit_Consumables has no deleted_at column.
    this.rows.splice(index, 1)
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}