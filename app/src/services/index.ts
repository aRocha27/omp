/**
 * Repository factory.
 *
 * Selects the concrete repository implementation by `DATA_MODE`.
 * Mock mode is the only supported mode during the UI-first phase; the HTTP
 * repository lands during integration (INTEGRATION_PLAN.md §6).
 */
import { env } from '@/app/configuration/env'
import type { OrdersRepository } from './contracts/orders.repository'
import type { DashboardRepository } from './contracts/dashboard.repository'
import type { ClientsRepository } from './contracts/clients.repository'
import type { ReconhecimentoRepository } from './contracts/reconhecimento.repository'
import type { DocumentoFaturacaoRepository } from './contracts/documento-faturacao.repository'
import type { ReferenceRepository } from './contracts/reference.repository'
import type { KitConsumableRepository } from './contracts/kit-consumable.repository'
import type { RecognitionReportRepository } from './contracts/recognition-report.repository'
import { MockOrdersRepository } from './mock/orders.mock-repository'
import { MockDashboardRepository } from './mock/dashboard.mock-repository'
import { HttpOrdersRepository } from './http/orders.http-repository'
import { HttpDashboardRepository } from './http/dashboard.http-repository'
import { HttpClientsRepository } from './http/clients.http-repository'
import { MockReconhecimentoRepository } from './mock/reconhecimento.mock-repository'
import { MockDocumentoFaturacaoRepository } from './mock/documento-faturacao.mock-repository'
import { MockReferenceRepository } from './mock/reference.mock-repository'
import { MockKitConsumableRepository } from './mock/kit-consumable.mock-repository'
import { MockRecognitionReportRepository } from './mock/recognition-report.mock-repository'
import { MockDataStore } from './mock/mock-data-store'
import { HttpReconhecimentoRepository } from './http/reconhecimento.http-repository'
import { HttpDocumentoFaturacaoRepository } from './http/documento-faturacao.http-repository'
import { HttpReferenceRepository } from './http/reference.http-repository'
import { HttpKitConsumableRepository } from './http/kit-consumable.http-repository'
import { HttpRecognitionReportRepository } from './http/recognition-report.http-repository'

export interface Repositories {
  dashboard: DashboardRepository
  orders: OrdersRepository
  // Clients are HTTP-only in BOTH data modes — the user explicitly wants no
  // fictitious client data, so there's no mock repository for them. In `mock`
  // mode without a server the Clients tab errors out (intended).
  clients: ClientsRepository
  reconhecimentos: ReconhecimentoRepository
  facturacao: DocumentoFaturacaoRepository
  // Área → Produto → Instrumento reference cascade. Mock in test/dev mode (filters
  // the harvested fixtures), live in `api` mode (GET /api/areas|produtos|instrumentos).
  reference: ReferenceRepository
  // Kit_Consumables sub-table (order detail Kit tab). Mock in test/dev mode,
  // live in `api` mode (GET/POST /orders/kit-consumables[...]).
  kitConsumables: KitConsumableRepository
  // Recognition report (year/month crosstab). Mock in test/dev, live in `api` mode.
  recognitionReport: RecognitionReportRepository
}

export function createRepositories(): Repositories {
  // Clients are always live — the client directory reads through the Node API in
  // both `api` and `mock` data modes.
  const clients = new HttpClientsRepository()
  const dashboard = env.dataMode === 'api'
    ? new HttpDashboardRepository()
    : new MockDashboardRepository()
  // `api` reads live from the Node API (query-on-demand, DB is system of record).
  // `mock` (default) keeps the self-contained fixture-backed repository for dev/CI.
  if (env.dataMode === 'api') {
    return {
      dashboard,
      orders: new HttpOrdersRepository(),
      clients,
      reconhecimentos: new HttpReconhecimentoRepository(),
      facturacao: new HttpDocumentoFaturacaoRepository(),
      reference: new HttpReferenceRepository(),
      kitConsumables: new HttpKitConsumableRepository(),
      recognitionReport: new HttpRecognitionReportRepository(),
    }
  }
  const mockStore = new MockDataStore()
  return {
    dashboard,
    orders: new MockOrdersRepository(mockStore),
    clients,
    reconhecimentos: new MockReconhecimentoRepository(mockStore),
    facturacao: new MockDocumentoFaturacaoRepository(mockStore),
    reference: new MockReferenceRepository(),
    kitConsumables: new MockKitConsumableRepository(mockStore),
    recognitionReport: new MockRecognitionReportRepository(),
  }
}

export * from './contracts'