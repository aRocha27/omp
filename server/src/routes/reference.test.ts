import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ConnectionPool } from 'mssql'
import { createApp, type AppDependencies } from '../app.js'
import { OrdersProfileNotConfiguredError } from '../profiles.js'
import type {
  AreaRow,
  ConnectionConfig,
  InstrumentoRow,
  ProdutoRow,
} from '../types.js'

const credentials: ConnectionConfig = {
  server: 'sql-orders.internal',
  port: 1433,
  database: 'OMP_DEMO',
  user: 'omp_demo_user',
  password: 'never-log-this-password',
}

const areas: AreaRow[] = [
  { id: 'BDAL', label: 'BDAL' },
  { id: 'BOPT', label: 'BOPT' },
]

const produtos: ProdutoRow[] = [
  { id: 1, label: 'Produto 1', area: 'BOPT' },
  { id: 5, label: 'Produto 5', area: 'BDAL' },
]

const instrumentos: InstrumentoRow[] = [
  { id: 1, label: 'Instr 1', produto: 1 },
  { id: 4, label: 'Instr 4', produto: 5 },
]

function referenceDependencies(overrides: Partial<AppDependencies> = {}) {
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
    fetchDashboardSnapshot: vi.fn(async () => ({
      year: 2026,
      kpis: {
        ordersBookedYtd: 0,
        amountToInvoice: 0,
        nobYtd: 0,
        revenueRecognizedYtd: 0,
        backlogToRecognize: 0,
        backlogAtPeriodStart: 0,
      },
      monthlyTrend: [],
      recognitionQueue: [],
      warrantyMissing: [],
      notFullyInvoiced: [],
      recentOrders: [],
    })),
    fetchInvoicingSnapshot: vi.fn(async () => ({ amountToInvoice: 0, notFullyInvoiced: [], warrantyMissing: [] })),
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
    updateOrderWarrantyYears: vi.fn(async () => true),
    fetchClientSummaries: vi.fn(async () => []),
    fetchClientById: vi.fn(async () => null),
    fetchAreas: vi.fn(async () => areas),
    fetchProdutos: vi.fn(async () => produtos),
    fetchInstrumentos: vi.fn(async () => instrumentos),
    close,
    ...overrides,
  }
  return values
}

const TEST_ADMIN_TOKEN = 'test-admin-secret'

function referenceApi(deps: AppDependencies, token: string | null = TEST_ADMIN_TOKEN) {
  const app = createApp(deps, token === null ? { token: null } : { token })
  const auth = token ? { Authorization: `Bearer ${token}` } : {}
  return {
    get: (path: string) => request(app).get(path).set(auth),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Reference cascade API', () => {
  it('lists all areas through the managed profile', async () => {
    const deps = referenceDependencies()
    const response = await referenceApi(deps).get('/api/areas')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, areas })
    expect(deps.resolveOrdersProfile).toHaveBeenCalledOnce()
    expect(deps.fetchAreas).toHaveBeenCalledWith(expect.anything())
  })

  it('lists produtos filtered by area when ?area is provided', async () => {
    const deps = referenceDependencies()
    const response = await referenceApi(deps).get('/api/produtos?area=BDAL')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, produtos })
    expect(deps.fetchProdutos).toHaveBeenCalledWith(expect.anything(), 'BDAL')
  })

  it('lists all produtos when no area filter is provided', async () => {
    const deps = referenceDependencies()
    const response = await referenceApi(deps).get('/api/produtos')

    expect(response.status).toBe(200)
    expect(deps.fetchProdutos).toHaveBeenCalledWith(expect.anything(), undefined)
  })

  it('lists instrumentos filtered by produto when ?produto is provided', async () => {
    const deps = referenceDependencies()
    const response = await referenceApi(deps).get('/api/instrumentos?produto=1')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, instrumentos })
    expect(deps.fetchInstrumentos).toHaveBeenCalledWith(expect.anything(), 1)
  })

  it('lists all instrumentos when no produto filter is provided', async () => {
    const deps = referenceDependencies()
    const response = await referenceApi(deps).get('/api/instrumentos')

    expect(response.status).toBe(200)
    expect(deps.fetchInstrumentos).toHaveBeenCalledWith(expect.anything(), undefined)
  })

  it('rejects a non-numeric produto query parameter', async () => {
    const deps = referenceDependencies()
    const response = await referenceApi(deps).get('/api/instrumentos?produto=abc')

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ ok: false, code: 'validation' })
    expect(deps.openPool).not.toHaveBeenCalled()
  })

  it('rejects a non-positive produto query parameter', async () => {
    const deps = referenceDependencies()
    const response = await referenceApi(deps).get('/api/instrumentos?produto=0')

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ ok: false, code: 'validation' })
    expect(deps.openPool).not.toHaveBeenCalled()
  })

  it('rejects an empty area query parameter', async () => {
    const deps = referenceDependencies()
    const response = await referenceApi(deps).get('/api/produtos?area=%20')

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ ok: false, code: 'validation' })
    expect(deps.openPool).not.toHaveBeenCalled()
  })

  it('maps a missing orders profile to 502 orders-not-configured', async () => {
    const deps = referenceDependencies({
      resolveOrdersProfile: vi.fn(() => {
        throw new OrdersProfileNotConfiguredError(
          'No database connection profile is configured for the Orders endpoint.',
        )
      }),
    })
    const response = await referenceApi(deps).get('/api/areas')

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
    const deps = referenceDependencies({
      openPool: vi.fn(async () => {
        throw new Error(`Login failed for password ${credentials.password}`)
      }),
    })

    const response = await referenceApi(deps).get('/api/areas')

    expect(response.status).toBe(502)
    expect(response.body).toEqual({
      ok: false,
      code: 'login-failed',
      message: 'Login failed. Check the username and password.',
    })
    expect(JSON.stringify(response.body)).not.toContain(credentials.password)
  })

  it('allows tokenless access on loopback when no admin token is configured', async () => {
    const deps = referenceDependencies()
    const response = await referenceApi(deps, null).get('/api/areas')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, areas })
  })
})
