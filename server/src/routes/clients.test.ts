import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ConnectionPool } from 'mssql'
import { createApp, type AppDependencies } from '../app.js'
import { OrdersProfileNotConfiguredError } from '../profiles.js'
import type { ClientDetailRow, ClientSummaryRow, ConnectionConfig } from '../types.js'

const credentials: ConnectionConfig = {
  server: 'sql-orders.internal',
  port: 1433,
  database: 'OMP_DEMO',
  user: 'omp_demo_user',
  password: 'never-log-this-password',
}

const summaryRow: ClientSummaryRow = {
  ID_Cliente: 2,
  no_PHC: 12,
  ID_Tp_Cliente: 1,
  nome: 'ITQB Noval',
  ncont: 500000000,
  telefone: '+351-21-000-0000',
  local: 'Oeiras',
}

const detailRow: ClientDetailRow = {
  ID_Cliente: 2,
  no_PHC: 12,
  ID_Tp_Cliente: 1,
  nome: 'ITQB Noval',
  ncont: 500000000,
  fax: null,
  telefone: '+351-21-000-0000',
  contacto: 'João',
  morada: 'Av. da República',
  local: 'Oeiras',
  codpost: '2780-157',
  zona: 'Lisboa',
  Defense: false,
}

function clientsDependencies(overrides: Partial<AppDependencies> = {}) {
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
    fetchClientSummaries: vi.fn(async () => [summaryRow]),
    fetchClientById: vi.fn(async () => detailRow),
    close,
    ...overrides,
  }
  return values
}

const TEST_ADMIN_TOKEN = 'test-admin-secret'

function clientsApi(deps: AppDependencies, token: string | null = TEST_ADMIN_TOKEN) {
  const app = createApp(deps, token === null ? { token: null } : { token })
  const auth = token ? { Authorization: `Bearer ${token}` } : {}
  return {
    get: (path: string) => request(app).get(path).set(auth),
    post: (path: string) => request(app).post(path).set(auth),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Clients API', () => {
  it('lists clients through the managed profile without a default limit', async () => {
    const deps = clientsDependencies()
    const response = await clientsApi(deps).post('/api/clients/list').send({ filters: {} })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, clients: [summaryRow] })
    expect(deps.resolveOrdersProfile).toHaveBeenCalledOnce()
    expect(deps.fetchClientSummaries).toHaveBeenCalledWith(expect.anything(), {}, undefined)
  })

  it('forwards filters and a custom limit to the repository', async () => {
    const deps = clientsDependencies()
    const filters = { search: 'ITQB', idTpCliente: [1, 2] }
    const response = await clientsApi(deps).post('/api/clients/list').send({ filters, limit: 50 })

    expect(response.status).toBe(200)
    expect(deps.fetchClientSummaries).toHaveBeenCalledWith(expect.anything(), filters, 50)
  })

  it('returns an empty clients array when no rows match', async () => {
    const deps = clientsDependencies({
      fetchClientSummaries: vi.fn(async () => []),
    })
    const response = await clientsApi(deps)
      .post('/api/clients/list')
      .send({ filters: { search: 'zzz' } })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, clients: [] })
  })

  it('rejects a limit above 10000 before opening a connection', async () => {
    const deps = clientsDependencies()
    const response = await clientsApi(deps).post('/api/clients/list').send({ limit: 10001 })

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ ok: false, code: 'validation' })
    expect(deps.openPool).not.toHaveBeenCalled()
  })

  it('rejects an invalid limit as validation', async () => {
    const deps = clientsDependencies()
    const response = await clientsApi(deps).post('/api/clients/list').send({ limit: 0 })

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ ok: false, code: 'validation' })
    expect(deps.openPool).not.toHaveBeenCalled()
  })

  it('fetches a single client by id', async () => {
    const deps = clientsDependencies()
    const response = await clientsApi(deps).get('/api/clients?id=2')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, client: detailRow })
    expect(deps.fetchClientById).toHaveBeenCalledWith(expect.anything(), 2)
  })

  it('returns a null client (200) when the id does not exist', async () => {
    const deps = clientsDependencies({ fetchClientById: vi.fn(async () => null) })
    const response = await clientsApi(deps).get('/api/clients?id=9999999')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, client: null })
  })

  it('rejects a missing id query parameter', async () => {
    const deps = clientsDependencies()
    const response = await clientsApi(deps).get('/api/clients')

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ ok: false, code: 'validation' })
    expect(deps.openPool).not.toHaveBeenCalled()
  })

  it('rejects a non-numeric id', async () => {
    const deps = clientsDependencies()
    const response = await clientsApi(deps).get('/api/clients?id=abc')

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ ok: false, code: 'validation' })
  })

  it('maps a missing orders profile to 502 orders-not-configured', async () => {
    const deps = clientsDependencies({
      resolveOrdersProfile: vi.fn(() => {
        throw new OrdersProfileNotConfiguredError(
          'No database connection profile is configured for the Orders endpoint.',
        )
      }),
    })
    const response = await clientsApi(deps).post('/api/clients/list').send({ filters: {} })

    expect(response.status).toBe(502)
    expect(response.body).toEqual({
      ok: false,
      code: 'orders-not-configured',
      message: 'No database connection profile is configured for the Orders endpoint.',
    })
    expect(deps.openPool).not.toHaveBeenCalled()
  })

  it('returns sanitized connection errors and never logs the password', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const deps = clientsDependencies({
      openPool: vi.fn(async () => {
        throw new Error(`Login failed for password ${credentials.password}`)
      }),
    })

    const response = await clientsApi(deps).post('/api/clients/list').send({ filters: {} })

    expect(response.status).toBe(502)
    expect(response.body).toEqual({
      ok: false,
      code: 'login-failed',
      message: 'Login failed. Check the username and password.',
    })
    expect(JSON.stringify(response.body)).not.toContain(credentials.password)
  })

  it('allows tokenless access on loopback when no admin token is configured', async () => {
    const deps = clientsDependencies()
    const response = await clientsApi(deps, null).get('/api/clients?id=2')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, client: detailRow })
  })

  it('requires the admin token when one is configured (production auth gap — R-A)', async () => {
    const deps = clientsDependencies()
    const app = createApp(deps, { token: 'admin-secret' })

    const missing = await request(app).get('/api/clients?id=2')

    expect(missing.status).toBe(401)
    expect(missing.body).toEqual({
      ok: false,
      code: 'unauthorized',
      message: 'Administrator authentication is required.',
    })
  })
})
