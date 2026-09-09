import type { InvoicingRepository } from '@/services/contracts/invoicing.repository'
import type { InvoicingSnapshot } from '@/domain/models/invoicing'
import { orders } from '@/fixtures/orders'
import { facturacao } from '@/fixtures/facturacao'
import { MockDataStore } from '@/services/mock/mock-data-store'
import { delay } from '@/services/mock/_constants'


function buildSnapshot(store: MockDataStore): InvoicingSnapshot {
  const warrantyMissing = orders
    .filter((order) => order.Tipo_Warranty === true && order.Warranty_DT_Inicio == null)
    .sort((a, b) => b.ID_Order - a.ID_Order)
    .map((order) => ({
      idOrder: order.ID_Order,
      encomendaCliPHC: order.Encomenda_Cli_PHC,
      client: order.Client_Name ?? null,
      area: order.ID_Area,
      type: order.ID_Tipo,
      idTipo: order.ID_Tipo,
      warranty: order.Tipo_Warranty,
      warrantyDtInicio: order.Warranty_DT_Inicio,
      sellPrice: order.Sell_Price,
      idTpWarranty: order.ID_Tp_Warranty,
      warrantyYears:
        order.ID_Tp_Warranty == null
          ? null
          : store.warrantyYearsByType[order.ID_Tp_Warranty] ?? null,
    }))

  const notFullyInvoiced = orders
    .map((order) => {
      const totalFaturado = facturacao
        .filter((doc) => doc.ID_Order === order.ID_Order)
        .reduce((sum, doc) => sum + (doc.Valor_Doc_FT ?? 0), 0)
      const diferenca = (order.Sell_Price ?? 0) - totalFaturado
      return {
        idOrder: order.ID_Order,
        encomendaCliPHC: order.Encomenda_Cli_PHC,
        client: order.Client_Name ?? null,
        area: order.ID_Area,
        type: order.ID_Tipo,
        sellPrice: order.Sell_Price,
        totalFaturado,
        diferenca,
      }
    })
    .filter((row) => (row.diferenca ?? 0) > 0)
    .sort((a, b) => (b.diferenca ?? 0) - (a.diferenca ?? 0) || b.idOrder - a.idOrder)

  return {
    amountToInvoice: notFullyInvoiced.reduce((sum, row) => sum + (row.diferenca ?? 0), 0),
    notFullyInvoiced,
    warrantyMissing,
    pendingRecognition: [],
    pendingRecognitionTotal: 0,
  }
}

export class MockInvoicingRepository implements InvoicingRepository {
  constructor(private readonly store: MockDataStore = new MockDataStore()) {}

  async getSnapshot(): Promise<InvoicingSnapshot> {
    await delay(80)
    const snapshot = buildSnapshot(this.store)
    return {
      amountToInvoice: snapshot.amountToInvoice,
      notFullyInvoiced: snapshot.notFullyInvoiced.map((row) => ({ ...row })),
      warrantyMissing: snapshot.warrantyMissing.map((row) => ({ ...row })),
      pendingRecognition: snapshot.pendingRecognition?.map((row) => ({ ...row })) ?? [],
      pendingRecognitionTotal: snapshot.pendingRecognitionTotal,
    }
  }
}
