import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ConnectionPool } from 'mssql'
import { createApp, type AppDependencies } from '../app.js'
import { OrdersProfileNotConfiguredError } from '../profiles.js'
import type { ConnectionConfig, DashboardSnapshotRow } from '../types.js'

const credentials: ConnectionConfig = {
  server: 'sql-orders.internal',
  port: 1433,
  database: 'BRKR_ERP',
  user: 'BRKRBasic',
  password: 'never-log-this-password',
}

const dashboard: DashboardSnapshotRow = {
  year: 2026,
  kpis: {
    ordersBookedYtd: 8,
    nobYtd: 125000,
    revenueRecognizedYtd: 82000,
    backlogToRecognize: 43000,
    backlogAtPeriodStart: 51000,
  },
  monthlyTrend: [
    { monthStart: '2026-01-01T00:00:00.000Z', revenue: 0, nob: 25000 },
    { monthStart: '2026-02-01T00:00:00.000Z', revenue: 12000, nob: 0 },
  ],
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

function dashboardDependencies(overrides: Partial<AppDependencies> = {}) {
  const close = vi.fn().mockResolvedValue(undefined)
  const pool = { close } as unknown as ConnectionPool
  const values: AppDependencies & { close: ReturnType<typeof vi.fn> } = {
    allowAdHocConnections: true,
    adHocTrustServerCertificate: false,
    listProfileMetadata: vi.fn(() => []),
    resolveProfile: vi.fn(() => credentials),
    openPool: vi.fn(async () => pool),
    listTables: vi.fn(async () => []),
    fetchRows: vi.fn(async () => ({ columns: [], rows: [] })),
    fetchAllTables: vi.fn(async () => []),
    fetchUtilizadores: vi.fn(async () => []),
    createUtilizador: vi.fn(async () => null as never),
    resolveOrdersProfile: vi.fn(() => credentials),
    fetchOrderSummaries: vi.fn(async () => []),
    fetchOrderById: vi.fn(async () => null),
    fetchDashboardSnapshot: vi.fn(async () => dashboard),
    fetchRecognitionQueue: vi.fn(async () => dashboard.recognitionQueue),
    updateOrder: vi.fn(async () => null),
    createOrder: vi.fn(async () => null as never),
    fetchReconhecimentos: vi.fn(async () => []),
    fetchFacturacao: vi.fn(async () => []),
    fetchFacturacaoTypes: vi.fn(async () => []),
    addReconhecimento: vi.fn(async () => null as never),
    updateReconhecimento: vi.fn(async () => null),
    deleteReconhecimento: vi.fn(async () => false),
    propagateReconhecimento: vi.fn(async () => []),
    addFacturacao: vi.fn(async () => null as never),
    updateFacturacao: vi.fn(async () => null),
    deleteFacturacao: vi.fn(async () => false),
    fetchKitConsumables: vi.fn(async () => []),
    addKitConsumable: vi.fn(async () => null as never),
    updateKitConsumable: vi.fn(async () => null),
    deleteKitConsumable: vi.fn(async () => false),
    fetchClientSummaries: vi.fn(async () => []),
    fetchClientById: vi.fn(async () => null),
    fetchAreas: vi.fn(async () => []),
    fetchProdutos: vi.fn(async () => []),
    fetchInstrumentos: vi.fn(async () => []),
    close,
    ...overrides,
  }
  return values
}

const TEST_ADMIN_TOKEN = 'test-admin-secret'

function dashboardApi(deps: AppDependencies, token: string | null = TEST_ADMIN_TOKEN) {
  const app = createApp(deps, token === null ? { token: null } : { token })
  const auth = token ? { Authorization: `Bearer ${token}` } : {}
  return {
    get: (path: string) => request(app).get(path).set(auth),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Dashboard API', () => {
  it('returns the dashboard snapshot through the managed profile', async () => {
    const deps = dashboardDependencies()
    const response = await dashboardApi(deps).get('/api/dashboard')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, dashboard })
    expect(deps.resolveOrdersProfile).toHaveBeenCalledOnce()
    expect(deps.fetchDashboardSnapshot).toHaveBeenCalledWith(expect.anything())
    expect(deps.close).toHaveBeenCalledOnce()
  })

  it('maps a missing orders profile to 502 orders-not-configured', async () => {
    const deps = dashboardDependencies({
      resolveOrdersProfile: vi.fn(() => {
        throw new OrdersProfileNotConfiguredError(
          'No database connection profile is configured for the Orders endpoint.',
        )
      }),
    })

    const response = await dashboardApi(deps).get('/api/dashboard')

    expect(response.status).toBe(502)
    expect(response.body).toEqual({
      ok: false,
      code: 'orders-not-configured',
      message: 'No database connection profile is configured for the Orders endpoint.',
    })
    expect(deps.openPool).not.toHaveBeenCalled()
  })

  it('sanitizes connection errors and never logs the password', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const deps = dashboardDependencies({
      openPool: vi.fn(async () => {
        throw new Error(`Login failed for password ${credentials.password}`)
      }),
    })

    const response = await dashboardApi(deps).get('/api/dashboard')

    expect(response.status).toBe(502)
    expect(response.body).toEqual({
      ok: false,
      code: 'login-failed',
      message: 'Login failed. Check the username and password.',
    })
    expect(JSON.stringify(response.body)).not.toContain(credentials.password)
  })

  it('allows tokenless access on loopback when no admin token is configured', async () => {
    const deps = dashboardDependencies()
    const response = await dashboardApi(deps, null).get('/api/dashboard')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, dashboard })
  })

  it('returns the full recognition queue through the managed profile', async () => {
    const deps = dashboardDependencies()
    const response = await dashboardApi(deps).get('/api/dashboard/recognition-queue')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, recognitionQueue: dashboard.recognitionQueue })
    expect(deps.fetchRecognitionQueue).toHaveBeenCalledWith(expect.anything())
    expect(deps.close).toHaveBeenCalledOnce()
  })
})
