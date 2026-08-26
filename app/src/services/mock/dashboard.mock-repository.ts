import type { DashboardRecognitionQueueItem, DashboardSnapshot } from '@/domain/models/dashboard'
import type { DashboardRepository } from '@/services/contracts/dashboard.repository'
import { orders, toOrderSummary } from '@/fixtures/orders'
import { reconhecimentos } from '@/fixtures/reconhecimentos'

const MOCK_LATENCY_MS = 80

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

function buildMockSnapshot(): DashboardSnapshot {
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
  return {
    year,
    kpis: {
      ordersBookedYtd: currentYearOrders.length,
      nobYtd: currentYearClientOrders.reduce((sum, order) => sum + (order.Sell_Price ?? 0), 0),
      revenueRecognizedYtd,
      backlogToRecognize,
      backlogAtPeriodStart,
    },
    monthlyTrend: Array.from({ length: 8 }, (_, index) => ({
      monthStart: new Date(Date.UTC(year, index, 1)).toISOString(),
      revenue: [12000, 9000, 15000, 13000, 17000, 11000, 14500, 11000][index] ?? 0,
      nob: [18000, 0, 12000, 25000, 8000, 19000, 14000, 15500][index] ?? 0,
    })),
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
    recentOrders: [...orders]
      .sort((a, b) => (a.DT_Order === b.DT_Order ? b.ID_Order - a.ID_Order : a.DT_Order < b.DT_Order ? 1 : -1))
      .slice(0, 5)
      .map(toOrderSummary),
  }
}

export class MockDashboardRepository implements DashboardRepository {
  async getSnapshot(): Promise<DashboardSnapshot> {
    await delay(MOCK_LATENCY_MS)
    const snapshot = buildMockSnapshot()
    return {
      year: snapshot.year,
      kpis: { ...snapshot.kpis },
      monthlyTrend: snapshot.monthlyTrend.map((point) => ({ ...point })),
      recognitionQueue: snapshot.recognitionQueue.map((row) => ({ ...row })),
      recentOrders: snapshot.recentOrders.map((row) => ({ ...row })),
    }
  }

  async getRecognitionQueue(): Promise<DashboardRecognitionQueueItem[]> {
    await delay(MOCK_LATENCY_MS)
    const snapshot = buildMockSnapshot()
    return snapshot.recognitionQueue.map((row) => ({ ...row }))
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
