/**
 * Repository factory.
 *
 * Selects the concrete repository implementation by `DATA_MODE`.
 * Mock mode is the only supported mode during the UI-first phase; the HTTP
 * repository lands during integration (INTEGRATION_PLAN.md §6).
 */
import { env } from '@/app/configuration/env'
import type { OrdersRepository } from './contracts/orders.repository'
import { MockOrdersRepository } from './mock/orders.mock-repository'

export interface Repositories {
  orders: OrdersRepository
}

export function createRepositories(): Repositories {
  if (env.dataMode === 'api') {
    // HttpOrdersRepository is implemented during the integration phase.
    throw new Error(
      'DATA_MODE=api is not supported yet — the HTTP repository is implemented during the integration phase.',
    )
  }
  return { orders: new MockOrdersRepository() }
}

export * from './contracts'