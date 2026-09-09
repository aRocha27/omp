import type { DocumentoFaturacao } from '@/domain/models/documento-faturacao'
import type { Order } from '@/domain/models/order'
import type { Reconhecimento } from '@/domain/models/reconhecimento'
import { isWarrantyRecognition } from '@/domain/rules/recognition'
import { RepositoryError } from '@/services/contracts/orders.repository'

const MONEY_EPSILON = 0.00005

function warrantyReserve(order: Order): number {
  return order.Tipo_Warranty === true ? (order.Warranty_Reserve ?? 0) : 0
}

export function assertRecognitionCapacity(
  order: Order,
  existing: Reconhecimento[],
  candidateType: string,
  candidateValue: number,
): void {
  if (order.Sell_Price === null) {
    throw new RepositoryError(
      'server-error',
      'Sell Price is required to recognise values.',
    )
  }

  let instrumentRecognized = 0
  let warrantyRecognized = 0
  for (const row of existing) {
    const value = row.Valor_Reconhecimento ?? 0
    if (isWarrantyRecognition(row.ID_Tp_Reconhecimento)) {
      warrantyRecognized += value
    } else {
      instrumentRecognized += value
    }
  }
  if (isWarrantyRecognition(candidateType)) {
    warrantyRecognized += candidateValue
  } else {
    instrumentRecognized += candidateValue
  }

  const reserve = warrantyReserve(order)
  if (instrumentRecognized + warrantyRecognized > order.Sell_Price + MONEY_EPSILON) {
    throw new RepositoryError(
      'server-error',
      'Total recognised cannot exceed the Sell Price.',
    )
  }
  if (warrantyRecognized > reserve + MONEY_EPSILON) {
    throw new RepositoryError(
      'server-error',
      'Total recognised under warranty cannot exceed the Warranty Reserve.',
    )
  }
  if (instrumentRecognized > order.Sell_Price - reserve + MONEY_EPSILON) {
    throw new RepositoryError(
      'server-error',
      'The warranty reserve cannot be recognised with another recognition type.',
    )
  }
}

export function assertExistingRecognitionCapacity(
  order: Order,
  rows: Reconhecimento[],
): void {
  if (!rows.some((row) => (row.Valor_Reconhecimento ?? 0) !== 0)) return
  assertRecognitionCapacity(order, rows, '', 0)
}

export function assertNetInvoicingCapacity(
  order: Order,
  rows: DocumentoFaturacao[],
  candidateValue: number,
): void {
  if (order.Sell_Price === null) {
    throw new RepositoryError(
      'server-error',
      'Sell Price is required to invoice values.',
    )
  }
  const currentNet = rows.reduce(
    (sum, row) => sum + (row.Valor_Doc_FT ?? 0),
    0,
  )
  if (currentNet + candidateValue > order.Sell_Price + MONEY_EPSILON) {
    throw new RepositoryError(
      'server-error',
      'Net invoiced cannot exceed the Sell Price.',
    )
  }
}

export function assertExistingInvoicingCapacity(
  order: Order,
  rows: DocumentoFaturacao[],
): void {
  if (!rows.some((row) => (row.Valor_Doc_FT ?? 0) !== 0)) return
  assertNetInvoicingCapacity(order, rows, 0)
}
