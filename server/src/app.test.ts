import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ConnectionPool } from 'mssql'
import { createApp, type AppDependencies } from './app.js'
import type { ConnectionConfig, OrderDetailRow, OrderSummaryRow, TableInfo } from './types.js'

const credentials: ConnectionConfig = {
  server: 'sql-orders.internal',
  port: 1433,
  database: 'Orders',
  user: 'orders_app',
  password: 'never-log-this-password',
}

const summaryRow: OrderSummaryRow = {
  ID_Order: 101,
  DT_Order: '2026-08-23T00:00:00Z',
  Order_Factory: false,
  ID_Tp_Order: 'C',
  ID_Client: 93,
  Client_Name: 'ITQB Noval',
  ID_Area: 'BDAL',
  ID_Tipo: 'INSTR',
  ID_Produto: 2,
  ID_Instrumento: 1,
  Sell_Price: 12500,
  Negocio_Fechado: true,
  Encomenda_Cli_PHC: 'PHC-001',
  Kit: false,
  ID_Tp_Warranty: 2,
  Warranty_Reserve: 500,
  Warranty_DT_Inicio: '2026-01-01T00:00:00Z',
  Orc_Proposta: 'PROP-12000',
  PO_Cliente: 'PO-1',
  ID_Tp_Revenue: 1,
  Provisoria: false,
}

const detailRow: OrderDetailRow = {
  ...summaryRow,
  Tipo_Warranty: true,
  Facturado: false,
  Reconhecido: false,
  Cod_Enc_Fornecedor: 'SUP-1',
  Obs: 'Approved',
  ID_User: 'arocha',
  DT_User: '2026-08-23T00:00:00Z',
  Kit_Amount: null,
  Contacto: 'João',
}

function dependencies(overrides: Partial<AppDependencies> = {}) {
  const close = vi.fn().mockResolvedValue(undefined)
  const pool = { close } as unknown as ConnectionPool
  const tables: TableInfo[] = [{ schema: 'dbo', name: 'Orders', type: 'BASE TABLE' }]

  const values: AppDependencies & { close: ReturnType<typeof vi.fn> } = {
    allowAdHocConnections: true,
    adHocTrustServerCertificate: false,
    listProfileMetadata: vi.fn(() => [
      {
        id: 'production',
        name: 'Portugal Production',
        networkMode: 'private-remote' as const,
      },
    ]),
    resolveProfile: vi.fn(() => credentials),
    openPool: vi.fn(async () => pool),
    listTables: vi.fn(async () => tables),
    fetchRows: vi.fn(async () => ({
      columns: ['ID_Order', 'Client_Name'],
      rows: [{ ID_Order: 101, Client_Name: 'Acme' }],
    })),
    fetchAllTables: vi.fn(async () => [
      {
        schema: 'dbo',
        name: 'Orders',
        columns: ['ID_Order', 'Client_Name'],
        rows: [{ ID_Order: 101, Client_Name: 'Acme' }],
      },
    ]),
    fetchUtilizadores: vi.fn(async () => []),
    createUtilizador: vi.fn(async () => null as never),
    resolveOrdersProfile: vi.fn(() => credentials),
    fetchOrderSummaries: vi.fn(async () => [summaryRow]),
    fetchOrderById: vi.fn(async () => detailRow),
    fetchDashboardSnapshot: vi.fn(async () => ({
      year: 2026,
      kpis: {
        ordersBookedYtd: 0,
        nobYtd: 0,
        revenueRecognizedYtd: 0,
        backlogToRecognize: 0,
        backlogAtPeriodStart: 0,
      },
      monthlyTrend: [],
      recognitionQueue: [],
      recentOrders: [],
    })),
    updateOrder: vi.fn(async () => detailRow),
    createOrder: vi.fn(async () => detailRow),
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
    close,
    ...overrides,
  }

  return values
}

const TEST_ADMIN_TOKEN = 'test-admin-secret'

function administrationApi(deps: AppDependencies) {
  const api = request(createApp(deps, { token: TEST_ADMIN_TOKEN }))
  const authorization = `Bearer ${TEST_ADMIN_TOKEN}`
  return {
    get: (path: string) => api.get(path).set('Authorization', authorization),
    post: (path: string) => api.post(path).set('Authorization', authorization),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Administration API', () => {
  it('lists backend-managed profiles without credentials', async () => {
    const deps = dependencies()
    const response = await administrationApi(deps).get('/api/admin/profiles')

    expect(response.status).toBe(200)
    expect(response.body).toEqual([
      { id: 'production', name: 'Portugal Production', networkMode: 'private-remote' },
    ])
    expect(JSON.stringify(response.body)).not.toContain('password')
    expect(JSON.stringify(response.body)).not.toContain(credentials.server)
  })

  it('requires the configured server-side admin token before database access', async () => {
    const deps = dependencies()
    const auth = { token: 'admin-secret' }
    const app = createApp(deps, auth)

    const missing = await request(app).get('/api/admin/profiles')
    const wrong = await request(app)
      .get('/api/admin/profiles')
      .set('Authorization', 'Bearer wrong-secret')
    const allowed = await request(app)
      .get('/api/admin/profiles')
      .set('Authorization', 'Bearer admin-secret')

    expect(missing.status).toBe(401)
    expect(wrong.status).toBe(401)
    expect(missing.body).toEqual({
      ok: false,
      code: 'unauthorized',
      message: 'Administrator authentication is required.',
    })
    expect(allowed.status).toBe(200)
  })

  it('allows tokenless access on loopback when no admin token is configured', async () => {
    const deps = dependencies()
    const app = createApp(deps, { token: null })

    const withoutHeader = await request(app).get('/api/admin/profiles')
    expect(withoutHeader.status).toBe(200)
  })

  it('connects with ad-hoc credentials, lists tables, and closes the pool', async () => {
    const deps = dependencies()
    const response = await administrationApi(deps).post('/api/admin/connect').send({ credentials })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      ok: true,
      tables: [{ schema: 'dbo', name: 'Orders', type: 'BASE TABLE' }],
    })
    expect(deps.openPool).toHaveBeenCalledWith({
      ...credentials,
      trustServerCertificate: false,
    })
    expect(deps.close).toHaveBeenCalledOnce()
  })

  it('resolves a backend-managed profile before connecting', async () => {
    const deps = dependencies()
    const response = await administrationApi(deps)
      .post('/api/admin/tables')
      .send({ profileId: 'production' })

    expect(response.status).toBe(200)
    expect(deps.resolveProfile).toHaveBeenCalledWith('production')
    expect(deps.openPool).toHaveBeenCalledWith(credentials)
  })

  it('syncs the selected table and returns raw rows', async () => {
    const deps = dependencies()
    const response = await administrationApi(deps).post('/api/orders/sync').send({
      profileId: 'production',
      schema: 'dbo',
      table: 'Orders',
      limit: 100,
    })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      ok: true,
      columns: ['ID_Order', 'Client_Name'],
      rows: [{ ID_Order: 101, Client_Name: 'Acme' }],
    })
    expect(deps.fetchRows).toHaveBeenCalledWith(expect.anything(), 'dbo', 'Orders', 100)
    expect(deps.close).toHaveBeenCalledOnce()
  })

  it('syncs every table through a single connection and returns them all', async () => {
    const deps = dependencies()
    const response = await administrationApi(deps).post('/api/admin/sync-all').send({
      profileId: 'production',
      limit: 50,
    })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      ok: true,
      tables: [
        {
          schema: 'dbo',
          name: 'Orders',
          columns: ['ID_Order', 'Client_Name'],
          rows: [{ ID_Order: 101, Client_Name: 'Acme' }],
        },
      ],
    })
    expect(deps.fetchAllTables).toHaveBeenCalledWith(expect.anything(), 50)
    expect(deps.close).toHaveBeenCalledOnce()
  })

  it('rejects invalid request bodies before opening a connection', async () => {
    const deps = dependencies()
    const response = await administrationApi(deps).post('/api/admin/connect').send({})

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ ok: false, code: 'validation' })
    expect(deps.openPool).not.toHaveBeenCalled()
  })

  it('blocks ad-hoc credentials when production policy disables them', async () => {
    const deps = dependencies({ allowAdHocConnections: false })
    const response = await administrationApi(deps).post('/api/admin/connect').send({ credentials })

    expect(response.status).toBe(403)
    expect(response.body).toEqual({
      ok: false,
      code: 'ad-hoc-disabled',
      message: 'Ad-hoc database connections are disabled in this environment.',
    })
    expect(deps.openPool).not.toHaveBeenCalled()
  })

  it('rejects malformed JSON with a stable validation response', async () => {
    const response = await administrationApi(dependencies())
      .post('/api/admin/connect')
      .set('Content-Type', 'application/json')
      .send('{not-json')

    expect(response.status).toBe(400)
    expect(response.body).toEqual({
      ok: false,
      code: 'validation',
      message: 'The request body must be valid JSON.',
    })
  })

  it('returns sanitized connection errors and never logs the password', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const deps = dependencies({
      openPool: vi.fn(async () => {
        throw new Error(`Login failed for password ${credentials.password}`)
      }),
    })

    const response = await administrationApi(deps).post('/api/admin/connect').send({ credentials })

    expect(response.status).toBe(502)
    expect(response.body).toEqual({
      ok: false,
      code: 'login-failed',
      message: 'Login failed. Check the username and password.',
    })
    expect(JSON.stringify(response.body)).not.toContain(credentials.password)
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(credentials.password)
    expect(JSON.stringify(consoleLog.mock.calls)).not.toContain(credentials.password)
  })
})
