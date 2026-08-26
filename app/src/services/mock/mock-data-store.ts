import type { DocumentoFaturacao } from '@/domain/models/documento-faturacao'
import type { KitConsumable } from '@/domain/models/kit-consumable'
import type { Order } from '@/domain/models/order'
import type { Reconhecimento } from '@/domain/models/reconhecimento'
import { facturacao } from '@/fixtures/facturacao'
import { kitConsumables } from '@/fixtures/kit-consumables'
import { orders } from '@/fixtures/orders'
import { reconhecimentos } from '@/fixtures/reconhecimentos'

/**
 * Mutable fixture state shared by the mock repositories created for one app session.
 * A new store starts from defensive copies, so tests and separate repository factories
 * remain isolated while order-dependent validations always read the latest order values.
 */
export class MockDataStore {
  readonly orders: Order[] = orders.map((row) => ({ ...row }))
  readonly reconhecimentos: Reconhecimento[] = reconhecimentos.map((row) => ({ ...row }))
  readonly facturacao: DocumentoFaturacao[] = facturacao.map((row) => ({ ...row }))
  readonly kitConsumables: KitConsumable[] = kitConsumables.map((row) => ({ ...row }))

  private nextReconhecimentoId =
    this.reconhecimentos.reduce(
      (max, row) => Math.max(max, row.ID_Reconhecimento),
      0,
    ) + 1

  private nextFacturacaoId =
    this.facturacao.reduce((max, row) => Math.max(max, row.ID_Facturacao), 0) + 1

  private nextKitConsumableId =
    this.kitConsumables.reduce((max, row) => Math.max(max, row.ID_Kit), 0) + 1

  allocateReconhecimentoId(): number {
    return this.nextReconhecimentoId++
  }

  allocateFacturacaoId(): number {
    return this.nextFacturacaoId++
  }

  allocateKitConsumableId(): number {
    return this.nextKitConsumableId++
  }
}