/**
 * Mock Reconhecimento repository.
 *
 * Deterministic, in-memory implementation of `ReconhecimentoRepository` backed by
 * synthetic fixtures. May simulate latency but must not invent business rules
 * (docs/architecture/ARCHITECTURE.md §4, MOCK_DATA_CONTRACT.md §5).
 *
 * A mutable copy of the fixture array is kept so `add` persists for the session
 * without mutating the imported `readonly` fixture export.
 */
import type { Reconhecimento } from '@/domain/models/reconhecimento'
import type {
  NewReconhecimento,
  ReconhecimentoRepository,
} from '@/services/contracts/reconhecimento.repository'
import { reconhecimentos } from '@/fixtures/reconhecimentos'

/** Simulated network latency for realistic loading-state behaviour (ms). */
const MOCK_LATENCY_MS = 120

export class MockReconhecimentoRepository implements ReconhecimentoRepository {
  // Mutable session copy — `add` writes here, reads pull from here. Kept in sync
  // with `nextId` so concurrent-ish adds stay deterministic and never collide.
  private readonly rows: Reconhecimento[]
  private nextId: number

  constructor() {
    this.rows = reconhecimentos.map((row) => ({ ...row }))
    // PK generator starts one above the highest existing fixture id.
    this.nextId =
      this.rows.reduce((max, row) => Math.max(max, row.ID_Reconhecimento), 0) + 1
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

  async add(entry: NewReconhecimento): Promise<Reconhecimento> {
    await delay(MOCK_LATENCY_MS)
    const created: Reconhecimento = {
      ...entry,
      ID_Reconhecimento: this.nextId++,
      ID_User: entry.ID_User ?? 'mock',
      DT_User: new Date().toISOString(),
    }
    this.rows.push(created)
    return { ...created }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}