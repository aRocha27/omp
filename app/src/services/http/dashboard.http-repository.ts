import type { DashboardRecognitionQueueItem, DashboardSnapshot } from '@/domain/models/dashboard'
import type { DashboardRepository } from '@/services/contracts/dashboard.repository'
import {
  getJsonReadOnly,
  toRepositoryErrorReadOnly,
  type ApiFailure,
} from '@/services/http/_shared'

interface OkDashboardResponse {
  ok: true
  dashboard: DashboardSnapshot
}

interface OkRecognitionQueueResponse {
  ok: true
  recognitionQueue: DashboardRecognitionQueueItem[]
}

export class HttpDashboardRepository implements DashboardRepository {
  async getSnapshot(): Promise<DashboardSnapshot> {
    const data = await getJsonReadOnly<OkDashboardResponse | ApiFailure>('/dashboard')
    if (!data.ok) throw toRepositoryErrorReadOnly(data)
    return {
      year: data.dashboard.year,
      kpis: { ...data.dashboard.kpis },
      monthlyTrend: data.dashboard.monthlyTrend.map((point) => ({ ...point })),
      recognitionQueue: data.dashboard.recognitionQueue.map((row) => ({ ...row })),
      pendingRecognition: data.dashboard.pendingRecognition?.map((row) => ({ ...row })) ?? [],
      pendingRecognitionTotal: data.dashboard.pendingRecognitionTotal,
      warrantyMissing: data.dashboard.warrantyMissing.map((row) => ({ ...row })),
      warrantyMissingTotal: data.dashboard.warrantyMissingTotal,
      notFullyInvoiced: data.dashboard.notFullyInvoiced.map((row) => ({ ...row })),
      notFullyInvoicedTotal: data.dashboard.notFullyInvoicedTotal,
      recentOrders: data.dashboard.recentOrders.map((row) => ({ ...row })),
      waitingPoOrders: data.dashboard.waitingPoOrders?.map((row) => ({ ...row })) ?? [],
      waitingPoOrdersTotal: data.dashboard.waitingPoOrdersTotal,
      introduzirSapOrders: data.dashboard.introduzirSapOrders?.map((row) => ({ ...row })) ?? [],
      introduzirSapOrdersTotal: data.dashboard.introduzirSapOrdersTotal,
    }
  }

  async getRecognitionQueue(): Promise<DashboardRecognitionQueueItem[]> {
    const data = await getJsonReadOnly<OkRecognitionQueueResponse | ApiFailure>(
      '/dashboard/recognition-queue',
    )
    if (!data.ok) throw toRepositoryErrorReadOnly(data)
    return data.recognitionQueue.map((row) => ({ ...row }))
  }
}
