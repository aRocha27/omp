/**
 * Repository factory.
 *
 * Selects the concrete repository implementation by `DATA_MODE`.
 * Mock mode is the only supported mode during the UI-first phase; the HTTP
 * repository lands during integration (INTEGRATION_PLAN.md §6).
 */
import { env } from '@/app/configuration/env'
import type { OrdersRepository } from './contracts/orders.repository'
import type { ClientsRepository } from './contracts/clients.repository'
import type { ReconhecimentoRepository } from './contracts/reconhecimento.repository'
import type { DocumentoFaturacaoRepository } from './contracts/documento-faturacao.repository'
import { MockOrdersRepository } from './mock/orders.mock-repository'
import { HttpOrdersRepository } from './http/orders.http-repository'
import { HttpClientsRepository } from './http/clients.http-repository'
import { MockReconhecimentoRepository } from './mock/reconhecimento.mock-repository'
import { MockDocumentoFaturacaoRepository } from './mock/documento-faturacao.mock-repository'
import { MockDataStore } from './mock/mock-data-store'
import { HttpReconhecimentoRepository } from './http/reconhecimento.http-repository'
import { HttpDocumentoFaturacaoRepository } from './http/documento-faturacao.http-repository'

export interface Repositories {
  orders: OrdersRepository
  // Clients are HTTP-only in BOTH data modes — the user explicitly wants no
  // fictitious client data, so there's no mock repository for them. In `mock`
  // mode without a server the Clients tab errors out (intended).
  clients: ClientsRepository
  reconhecimentos: ReconhecimentoRepository
  facturacao: DocumentoFaturacaoRepository
}

export function createRepositories(): Repositories {
  // Clients are always live — the client directory reads through the Node API in
  // both `api` and `mock` data modes.
  const clients = new HttpClientsRepository()
  // `api` reads live from the Node API (query-on-demand, DB is system of record).
  // `mock` (default) keeps the self-contained fixture-backed repository for dev/CI.
  if (env.dataMode === 'api') {
    return {
      orders: new HttpOrdersRepository(),
      clients,
      reconhecimentos: new HttpReconhecimentoRepository(),
      facturacao: new HttpDocumentoFaturacaoRepository(),
    }
  }
  const mockStore = new MockDataStore()
  return {
    orders: new MockOrdersRepository(mockStore),
    clients,
    reconhecimentos: new MockReconhecimentoRepository(mockStore),
    facturacao: new MockDocumentoFaturacaoRepository(mockStore),
  }
}

export * from './contracts'