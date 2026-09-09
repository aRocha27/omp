import type { DashboardRecognitionQueueItem, DashboardSnapshot } from '@/domain/models/dashboard'
import type { DashboardRepository } from '@/services/contracts/dashboard.repository'
import { orders, toOrderSummary } from '@/fixtures/orders'
import { reconhecimentos } from '@/fixtures/reconhecimentos'
import { facturacao } from '@/fixtures/facturacao'
import { MockDataStore } from '@/services/mock/mock-data-store'
import { delay } from '@/services/mock/_constants'

/**
 * Filter an order collection to "Client" orders only (`ID_Tp_Order === 'C'`).
 *
 * The dashboard's NOB YTD and Revenue Recognized YTD are *Client* KPIs —
 * other order kinds (Stock, Warranty, Comercial, …) carry their own revenue
 * stream and are not added to the Client sales total. This helper is the
 * single seam where the rule is enforced in the mock; the live backend is
 * expected to apply the same filter server-side (see the contracts in
 * `services/contracts/dashboard.repository.ts`).
 */
function clientOrders() {
  return orders.filter((o) => o.ID_Tp_Order === 'C')
}

/**
 * Rolling 7-month window ending at the current month, mirroring the live
 * backend's trend query. The mock values are sourced from a fixed annual
 * template (Jan–Dec) so every month of any year has data.
 */
const TREND_WINDOW = 7
const MOCK_ANNUAL_REVENUE = [12000, 9000, 15000, 13000, 17000, 11000, 14500, 11000, 13000, 14000, 16000, 12500]
const MOCK_ANNUAL_NOB = [18000, 0, 12000, 25000, 8000, 19000, 14000, 15500, 17500, 9000, 13000, 11000]

function buildMockMonthlyTrend(todayYear: number) {
  const now = new Date()
  const start = new Date(Date.UTC(todayYear, now.getUTCMonth() - (TREND_WINDOW - 1), 1))
  return Array.from({ length: TREND_WINDOW }, (_, index) => {
    const monthDate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1))
    const monthIndex = monthDate.getUTCMonth()
    return {
      monthStart: monthDate.toISOString(),
      revenue: MOCK_ANNUAL_REVENUE[monthIndex] ?? 0,
      nob: MOCK_ANNUAL_NOB[monthIndex] ?? 0,
    }
  })
}

function buildMockSnapshot(store: MockDataStore): DashboardSnapshot {
  const now = new Date()
  const year = now.getUTCFullYear()
  const yearStartIso = `${year}-01-01`
  const todayIsoCutoff = now.toISOString()
  const currentYearClientOrders = clientOrders().filter(
    (o) => o.DT_Order >= yearStartIso && o.DT_Order < todayIsoCutoff,
  )
  const clientOrderIds = new Set(clientOrders().map((o) => o.ID_Order))
  const currentYearClientOrderIds = new Set(currentYearClientOrders.map((o) => o.ID_Order))
  // Sum the recognized revenue for current-year Client orders only — other
  // order kinds (Stock, Warranty, Comercial, …) have their own stream and are
  // not part of this KPI.
  const revenueRecognizedYtd = reconhecimentos
    .filter((r) => currentYearClientOrderIds.has(r.ID_Order))
    .filter((r) => {
      const date = r.DT_Reconhecimento ?? ''
      return date >= yearStartIso && date < todayIsoCutoff
    })
    .reduce((sum, r) => sum + (r.Valor_Reconhecimento ?? 0), 0)
  // Backlog at the start of the exercise: every Client order booked before 1 Jan
  // of the snapshot year minus every recognition posted before that same cut-off
  // for those orders.
  const backlogAtPeriodStart =
    clientOrders()
      .filter((o) => o.DT_Order < yearStartIso)
      .reduce((sum, o) => sum + (o.Sell_Price ?? 0), 0) -
    reconhecimentos
      .filter((r) => clientOrderIds.has(r.ID_Order))
      .filter((r) => (r.DT_Reconhecimento ?? '') < yearStartIso)
      .reduce((sum, r) => sum + (r.Valor_Reconhecimento ?? 0), 0)
  const backlogToRecognize =
    backlogAtPeriodStart +
    currentYearClientOrders.reduce((sum, o) => sum + (o.Sell_Price ?? 0), 0) -
    revenueRecognizedYtd
  const currentYearOrders = orders.filter(
    (o) => o.DT_Order >= yearStartIso && o.DT_Order < todayIsoCutoff,
  )
  const amountToInvoice = orders
    .map((order) => {
      const totalFaturado = facturacao
        .filter((doc) => doc.ID_Order === order.ID_Order)
        .reduce((sum, doc) => sum + (doc.Valor_Doc_FT ?? 0), 0)
      return Math.max(0, (order.Sell_Price ?? 0) - totalFaturado)
    })
    .reduce((sum, value) => sum + value, 0)
  return {
    year,
    kpis: {
      ordersBookedYtd: currentYearOrders.length,
      amountToInvoice,
      nobYtd: currentYearClientOrders.reduce((sum, order) => sum + (order.Sell_Price ?? 0), 0),
      revenueRecognizedYtd,
      backlogToRecognize,
      backlogAtPeriodStart,
    },
    monthlyTrend: buildMockMonthlyTrend(year),
    recognitionQueue: [
      {
        idOrder: 1001,
        encPhc: 'PHC-1001',
        orderDate: `${year}-08-14T00:00:00.000Z`,
        client: 'Client Alpha',
        area: 'BDAL',
        product: 'NMR',
        type: 'INSTRUMENT',
        sellPrice: 48500,
        recognizedValue: 32000,
        remainingValue: 16500,
        invoiced: false,
      },
      {
        idOrder: 1003,
        encPhc: 'PHC-1003',
        orderDate: `${year}-07-02T00:00:00.000Z`,
        client: 'Test Dealer',
        area: 'BOPT',
        product: 'XRF',
        type: 'ACESSORIES',
        sellPrice: 87000,
        recognizedValue: 54000,
        remainingValue: 33000,
        invoiced: true,
      },
    ],
    warrantyMissing: orders
      .filter((o) => o.Tipo_Warranty === true && o.Warranty_DT_Inicio == null)
      .sort((a, b) => b.ID_Order - a.ID_Order)
      .slice(0, 10)
      .map((o) => ({
        idOrder: o.ID_Order,
        encomendaCliPHC: o.Encomenda_Cli_PHC,
        client: o.Client_Name ?? null,
        area: o.ID_Area,
        type: o.ID_Tipo,
        idTipo: o.ID_Tipo,
        warranty: o.Tipo_Warranty,
        warrantyDtInicio: o.Warranty_DT_Inicio,
        sellPrice: o.Sell_Price,
        idTpWarranty: o.ID_Tp_Warranty,
        warrantyYears:
          o.ID_Tp_Warranty == null ? null : (store.warrantyYearsByType[o.ID_Tp_Warranty] ?? null),
      })),
    warrantyMissingTotal: orders.filter(
      (o) => o.Tipo_Warranty === true && o.Warranty_DT_Inicio == null,
    ).length,
    notFullyInvoiced: orders
      .map((order) => {
        const totalFaturado = facturacao
          .filter((doc) => doc.ID_Order === order.ID_Order)
          .reduce((sum, doc) => sum + (doc.Valor_Doc_FT ?? 0), 0)
        const diferenca = Math.max(0, (order.Sell_Price ?? 0) - totalFaturado)
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
      .filter((row) => row.diferenca > 0)
      .sort((a, b) => b.diferenca - a.diferenca || b.idOrder - a.idOrder)
      .slice(0, 10),
    notFullyInvoicedTotal: orders
      .map((order) => {
        const totalFaturado = facturacao
          .filter((doc) => doc.ID_Order === order.ID_Order)
          .reduce((sum, doc) => sum + (doc.Valor_Doc_FT ?? 0), 0)
        return Math.max(0, (order.Sell_Price ?? 0) - totalFaturado) > 0 ? 1 : 0
      })
      .reduce<number>((sum, v) => sum + v, 0),
    recentOrders: [...orders]
      .sort((a, b) =>
        a.DT_Order === b.DT_Order ? b.ID_Order - a.ID_Order : a.DT_Order < b.DT_Order ? 1 : -1,
      )
      .slice(0, 5)
      .map(toOrderSummary),
    waitingPoOrders: orders
      .filter((o) => o.ID_Tp_Order === 'WPO')
      .slice(0, 10)
      .map((o) => ({
        idOrder: o.ID_Order,
        encomendaCliPHC: o.Encomenda_Cli_PHC,
        client: o.Client_Name ?? null,
      })),
    waitingPoOrdersTotal: orders.filter((o) => o.ID_Tp_Order === 'WPO').length,
    introduzirSapOrders: orders
      .filter((o) => o.ID_Tp_Order === 'SAP')
      .slice(0, 10)
      .map((o) => ({
        idOrder: o.ID_Order,
        encomendaCliPHC: o.Encomenda_Cli_PHC,
        client: o.Client_Name ?? null,
      })),
    introduzirSapOrdersTotal: orders.filter((o) => o.ID_Tp_Order === 'SAP').length,
    // Mock backend never populates pendingRecognition (pre-existing gap); the
    // dashboard renders the count pill from this field when present, falling
    // back to the sample count otherwise.
    pendingRecognitionTotal: 0,
  }
}

export class MockDashboardRepository implements DashboardRepository {
  constructor(private readonly store: MockDataStore = new MockDataStore()) {}

  async getSnapshot(): Promise<DashboardSnapshot> {
    await delay(80)
    const snapshot = buildMockSnapshot(this.store)
    return {
      year: snapshot.year,
      kpis: { ...snapshot.kpis },
      monthlyTrend: snapshot.monthlyTrend.map((point) => ({ ...point })),
      recognitionQueue: snapshot.recognitionQueue.map((row) => ({ ...row })),
      pendingRecognition: snapshot.pendingRecognition?.map((row) => ({ ...row })) ?? [],
      pendingRecognitionTotal: snapshot.pendingRecognitionTotal,
      warrantyMissing: snapshot.warrantyMissing.map((row) => ({ ...row })),
      warrantyMissingTotal: snapshot.warrantyMissingTotal,
      notFullyInvoiced: snapshot.notFullyInvoiced.map((row) => ({ ...row })),
      notFullyInvoicedTotal: snapshot.notFullyInvoicedTotal,
      recentOrders: snapshot.recentOrders.map((row) => ({ ...row })),
      waitingPoOrders: snapshot.waitingPoOrders?.map((row) => ({ ...row })) ?? [],
      waitingPoOrdersTotal: snapshot.waitingPoOrdersTotal,
      introduzirSapOrders: snapshot.introduzirSapOrders?.map((row) => ({ ...row })) ?? [],
      introduzirSapOrdersTotal: snapshot.introduzirSapOrdersTotal,
    }
  }

  async getRecognitionQueue(): Promise<DashboardRecognitionQueueItem[]> {
    await delay(80)
    const snapshot = buildMockSnapshot(this.store)
    return snapshot.recognitionQueue.map((row) => ({ ...row }))
  }
}
