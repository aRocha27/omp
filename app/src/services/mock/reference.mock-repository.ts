/**
 * Mock reference-cascade repository.
 *
 * Deterministic, fixture-backed implementation of `ReferenceRepository`. Filters
 * the enriched `reference-data` fixtures (which carry the real `area`/`produto`
 * parent ids harvested from BRKR_ERP) so the create/detail cascade dropdowns behave
 * identically to the live `/api/areas|produtos|instrumentos` endpoints in mock mode.
 *
 * Read-only and stateless — no `MockDataStore` needed (reference data never mutates).
 */
import type {
  AreaOption,
  InstrumentoOption,
  ProdutoOption,
} from '@/domain/models/reference-cascade'
import type { ReferenceRepository } from '@/services/contracts/reference.repository'
import { areas, instrumentos, produtos } from '@/fixtures/reference-data'

/** Simulated network latency for realistic loading-state behaviour (ms). */
const MOCK_LATENCY_MS = 80

export class MockReferenceRepository implements ReferenceRepository {
  async listAreas(): Promise<AreaOption[]> {
    await delay(MOCK_LATENCY_MS)
    return areas.map((o) => ({ ...o }))
  }

  async listProdutos(area?: string): Promise<ProdutoOption[]> {
    await delay(MOCK_LATENCY_MS)
    return produtos
      .filter((o) => area === undefined || o.area === area)
      .map((o) => ({ ...o }))
  }

  async listInstrumentos(produto?: number): Promise<InstrumentoOption[]> {
    await delay(MOCK_LATENCY_MS)
    return instrumentos
      .filter((o) => produto === undefined || o.produto === produto)
      .map((o) => ({ ...o }))
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}