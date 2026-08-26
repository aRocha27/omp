import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpDashboardRepository } from '@/services/http/dashboard.http-repository'
import type { DashboardSnapshot } from '@/domain/models/dashboard'

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

const snapshot: DashboardSnapshot = {
  year: 2026,
  kpis: {
    ordersBookedYtd: 8,
    nobYtd: 125000,
    revenueRecognizedYtd: 82000,
    backlogToRecognize: 43000,
    backlogAtPeriodStart: 51000,
  },
  monthlyTrend: [{ monthStart: '2026-01-01T00:00:00.000Z', revenue: 1000, nob: 2000 }],
  recognitionQueue: [
    {
      idOrder: 1001,
      encPhc: '5052310',
      orderDate: '2026-08-25T00:00:00.000Z',
      client: 'Client Alpha',
      area: 'BDAL',
      product: 'ESI TOF',
      type: 'INSTRUMENT',
      sellPrice: 18500,
      recognizedValue: 11562,
      remainingValue: 6938,
      invoiced: false,
    },
  ],
  recentOrders: [],
}

describe('HttpDashboardRepository', () => {
  let repo: HttpDashboardRepository
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    repo = new HttpDashboardRepository()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('GETs /api/dashboard and returns the mapped snapshot', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, dashboard: snapshot }))

    await expect(repo.getSnapshot()).resolves.toEqual(snapshot)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/dashboard')
    expect(init?.method).toBe('GET')
  })

  it('maps a forbidden response to RepositoryError(forbidden)', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { ok: false, code: 'forbidden', message: 'role not allowed.' }),
    )

    await expect(repo.getSnapshot()).rejects.toMatchObject({
      kind: 'forbidden',
      message: 'role not allowed.',
    })
  })

  it('maps a network failure to RepositoryError(server-error)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))

    await expect(repo.getSnapshot()).rejects.toMatchObject({
      kind: 'server-error',
      message: "Couldn't reach the database service.",
    })
  })

  it('GETs /api/dashboard/recognition-queue and returns the queue rows', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { ok: true, recognitionQueue: snapshot.recognitionQueue }),
    )

    await expect(repo.getRecognitionQueue()).resolves.toEqual(snapshot.recognitionQueue)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/dashboard/recognition-queue')
    expect(init?.method).toBe('GET')
  })
})
