/**
 * Reference-cascade repository contract.
 *
 * Read-only access to the Área → Produto → Instrumento reference tables that power
 * the dependent dropdowns in the create/detail forms. UI code depends on this
 * interface, never on the concrete HTTP or mock implementation.
 *
 * `listProdutos(area?)` / `listInstrumentos(produto?)` accept an optional parent id:
 * when present the repository returns only the children of that parent; when absent
 * it returns every row (the non-cascaded filter dropdowns list all values).
 */
import type {
  AreaOption,
  InstrumentoOption,
  ProdutoOption,
} from '@/domain/models/reference-cascade'

export interface ReferenceRepository {
  listAreas(): Promise<AreaOption[]>
  listProdutos(area?: string): Promise<ProdutoOption[]>
  listInstrumentos(produto?: number): Promise<InstrumentoOption[]>
}

// Re-export so HTTP/mock implementations and callers import the shared error type
// from their own contract (mirrors clients.repository).
export { RepositoryError } from './orders.repository'