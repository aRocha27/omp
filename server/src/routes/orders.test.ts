import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ConnectionPool } from 'mssql'
import { createApp, type AppDependencies } from '../app.js'
import { RecognitionCapacityError, ClientNotFoundError } from '../db.js'
import { OrdersProfileNotConfiguredError } from '../profiles.js'
import type {
  ConnectionConfig,
  DocumentoFaturacaoRow,
  DocumentoFaturacaoTypeRow,
  KitConsumableRow,
  OrderDetailRow,
  OrderSummaryRow,
  ReconhecimentoRow,
} from '../types.js'

const credentials: ConnectionConfig = {
  server: 'sql-orders.internal',
  port: 1433,
  database: 'BRKR_ERP',
  user: 'BRKRBasic',
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

// A histórico (past-month), non-provisional order — the caracterização lock applies.
const historicoDetailRow: OrderDetailRow = {
  ...detailRow,
  ID_Order: 202,
  DT_Order: '2026-07-15T00:00:00Z',
  Provisoria: false,
}

// A provisional order — always editable, even on a past month.
const provisoriaDetailRow: OrderDetailRow = {
  ...detailRow,
  ID_Order: 303,
  DT_Order: '2026-07-15T00:00:00Z',
  Provisoria: true,
}

const reconhecimentoRows: ReconhecimentoRow[] = [
  {
    ID_Reconhecimento: 1,
    ID_Order: 101,
    ID_Tp_Reconhecimento: 'CM',
    DT_Reconhecimento: '2026-08-23T00:00:00Z',
    Valor_Reconhecimento: 5000,
    ID_User: 'arocha',
    DT_User: '2026-08-23T00:00:00Z',
  },
]

const documentTypes: DocumentoFaturacaoTypeRow[] = [
  { id: 'AcFT', label: 'Acerto Factura' },
  { id: 'FT', label: 'Factura' },
  { id: 'NC', label: 'Nota Crédito' },
]

const facturacaoRows: DocumentoFaturacaoRow[] = [
  {
    ID_Facturacao: 1,
    ID_Order: 101,
    DT_Doc_FT: '2026-08-23T00:00:00Z',
    ID_Tp_Doc_FT: 'FT',
    N_Doc_FT: 'FT 2026/1',
    Valor_Doc_FT: 12500,
    ID_User: 'arocha',
    DT_User: '2026-08-23T00:00:00Z',
  },
]

const kitConsumableRows: KitConsumableRow[] = [
  {
    ID_Kit: 1,
    ID_Order: 101,
    Date: '2026-08-23T00:00:00Z',
    Internal_Order: 'INT-1',
    Material: 'MAT-A',
    Description: 'Filter cartridge',
    Quant: 2,
    Unit_Price: 125,
    Total_Price: 250,
  },
]

function ordersDependencies(overrides: Partial<AppDependencies> = {}) {
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
    fetchFacturacaoTypes: vi.fn(async () => documentTypes),
    addReconhecimento: vi.fn(async () => reconhecimentoRows[0]),
    updateReconhecimento: vi.fn(async () => reconhecimentoRows[0]),
    deleteReconhecimento: vi.fn(async () => true),
    propagateReconhecimento: vi.fn(async () => reconhecimentoRows),
    addFacturacao: vi.fn(async () => facturacaoRows[0]),
    updateFacturacao: vi.fn(async () => facturacaoRows[0]),
    deleteFacturacao: vi.fn(async () => true),
    fetchKitConsumables: vi.fn(async () => []),
    addKitConsumable: vi.fn(async () => kitConsumableRows[0]),
    updateKitConsumable: vi.fn(async () => kitConsumableRows[0]),
    deleteKitConsumable: vi.fn(async () => true),
    fetchClientSummaries: vi.fn(async () => []),
    fetchClientById: vi.fn(async () => null),
    close,
    ...overrides,
  }
  return values
}

const TEST_ADMIN_TOKEN = 'test-admin-secret'

function ordersApi(deps: AppDependencies, token: string | null = TEST_ADMIN_TOKEN) {
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

describe('Orders API', () => {
  it('lists orders through the managed profile with the default limit', async () => {
    const deps = ordersDependencies()
    const response = await ordersApi(deps).post('/api/orders/list').send({ filters: {} })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, orders: [summaryRow] })
    expect(deps.resolveOrdersProfile).toHaveBeenCalledOnce()
    expect(deps.fetchOrderSummaries).toHaveBeenCalledWith(expect.anything(), {}, 200)
    expect(deps.close).toHaveBeenCalledOnce()
  })

  it('forwards filters and a custom limit to the repository', async () => {
    const deps = ordersDependencies()
    const filters = { idArea: ['BDAL'], idProduto: [2], negocioFechado: true }
    const response = await ordersApi(deps).post('/api/orders/list').send({ filters, limit: 50 })

    expect(response.status).toBe(200)
    expect(deps.fetchOrderSummaries).toHaveBeenCalledWith(expect.anything(), filters, 50)
  })

  it('rejects a limit above 1000 before opening a connection', async () => {
    const deps = ordersDependencies()
    const response = await ordersApi(deps).post('/api/orders/list').send({ limit: 1001 })

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ ok: false, code: 'validation' })
    expect(deps.openPool).not.toHaveBeenCalled()
  })

  it('rejects an invalid limit as validation', async () => {
    const deps = ordersDependencies()
    const response = await ordersApi(deps).post('/api/orders/list').send({ limit: 0 })

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ ok: false, code: 'validation' })
    expect(deps.openPool).not.toHaveBeenCalled()
  })

  it('fetches a single order by id', async () => {
    const deps = ordersDependencies()
    const response = await ordersApi(deps).get('/api/orders?id=101')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, order: detailRow })
    expect(deps.fetchOrderById).toHaveBeenCalledWith(expect.anything(), 101)
  })

  it('returns a null order (200) when the id does not exist', async () => {
    const deps = ordersDependencies({ fetchOrderById: vi.fn(async () => null) })
    const response = await ordersApi(deps).get('/api/orders?id=9999999')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, order: null })
  })

  it('rejects a missing id query parameter', async () => {
    const deps = ordersDependencies()
    const response = await ordersApi(deps).get('/api/orders')

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ ok: false, code: 'validation' })
    expect(deps.openPool).not.toHaveBeenCalled()
  })

  it('rejects a non-numeric id', async () => {
    const deps = ordersDependencies()
    const response = await ordersApi(deps).get('/api/orders?id=abc')

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ ok: false, code: 'validation' })
  })

  it('maps a missing orders profile to 502 orders-not-configured', async () => {
    const deps = ordersDependencies({
      resolveOrdersProfile: vi.fn(() => {
        throw new OrdersProfileNotConfiguredError(
          'No database connection profile is configured for the Orders endpoint.',
        )
      }),
    })
    const response = await ordersApi(deps).post('/api/orders/list').send({ filters: {} })

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
    const deps = ordersDependencies({
      openPool: vi.fn(async () => {
        throw new Error(`Login failed for password ${credentials.password}`)
      }),
    })

    const response = await ordersApi(deps).post('/api/orders/list').send({ filters: {} })

    expect(response.status).toBe(502)
    expect(response.body).toEqual({
      ok: false,
      code: 'login-failed',
      message: 'Login failed. Check the username and password.',
    })
    expect(JSON.stringify(response.body)).not.toContain(credentials.password)
  })

  it('allows tokenless access on loopback when no admin token is configured', async () => {
    const deps = ordersDependencies()
    const response = await ordersApi(deps, null).get('/api/orders?id=101')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, order: detailRow })
  })

  // R-A follow-up: the Orders endpoint has no token in its contract, so in production (with
  // ADMIN_API_TOKEN set) the browser would 401. This documents that gap — it must be solved
  // before the Orders tab ships to a non-loopback host.
  it('requires the admin token when one is configured (production auth gap — R-A)', async () => {
    const deps = ordersDependencies()
    const app = createApp(deps, { token: 'admin-secret' })

    const missing = await request(app).get('/api/orders?id=101')

    expect(missing.status).toBe(401)
    expect(missing.body).toEqual({
      ok: false,
      code: 'unauthorized',
      message: 'Administrator authentication is required.',
    })
  })
})

describe('Orders update endpoint', () => {
  it('updates a current-month order as editor and returns the updated row', async () => {
    const deps = ordersDependencies()
    const response = await ordersApi(deps, null)
      .post('/api/orders/update')
      .set('x-user-role', 'user')
      .send({ id: 101, patch: { Obs: 'Revised note' } })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, order: detailRow })
    expect(deps.fetchOrderById).toHaveBeenCalledWith(expect.anything(), 101)
    // Tokenless loopback mode honours an explicitly simulated editor role.
    expect(deps.updateOrder).toHaveBeenCalledWith(expect.anything(), 101, {
      Obs: 'Revised note',
      user: 'editor',
    })
  })

  it('fails closed for missing or unknown roles in loopback tokenless mode', async () => {
    const deps = ordersDependencies()
    const missing = await ordersApi(deps, null)
      .post('/api/orders/update')
      .send({ id: 101, patch: { Obs: 'x' } })
    const unknown = await ordersApi(deps, null)
      .post('/api/orders/update')
      .set('x-user-role', 'owner')
      .send({ id: 101, patch: { Obs: 'x' } })

    expect([missing.status, unknown.status]).toEqual([403, 403])
    expect(deps.fetchOrderById).not.toHaveBeenCalled()
    expect(deps.updateOrder).not.toHaveBeenCalled()
    expect(deps.openPool).not.toHaveBeenCalled()
  })

  it('binds a configured admin token to admin authority and ignores a spoofed role header', async () => {
    const deps = ordersDependencies({
      fetchOrderById: vi.fn(async () => historicoDetailRow),
    })
    const response = await ordersApi(deps)
      .post('/api/orders/update')
      .set('x-user-role', 'viewer')
      .send({ id: 202, patch: { Sell_Price: 9999 } })

    expect(response.status).toBe(200)
    expect(deps.updateOrder).toHaveBeenCalledWith(expect.anything(), 202, {
      Sell_Price: 9999,
      user: 'admin',
    })
  })

  it('rejects a viewer with 403 forbidden', async () => {
    const deps = ordersDependencies()
    const response = await ordersApi(deps, null)
      .post('/api/orders/update')
      .set('x-user-role', 'viewer')
      .send({ id: 101, patch: { Obs: 'x' } })

    expect(response.status).toBe(403)
    expect(response.body).toMatchObject({ ok: false, code: 'forbidden' })
    expect(deps.updateOrder).not.toHaveBeenCalled()
  })

  it('rejects an editor updating Caracterização on a histórico order with 403 field-locked', async () => {
    const deps = ordersDependencies({
      fetchOrderById: vi.fn(async () => historicoDetailRow),
    })
    const response = await ordersApi(deps, null)
      .post('/api/orders/update')
      .set('x-user-role', 'editor')
      .send({ id: 202, patch: { ID_Area: 'NEW' } })

    expect(response.status).toBe(403)
    expect(response.body).toMatchObject({ ok: false, code: 'field-locked' })
    expect(response.body.message).toContain('ID_Area')
    expect(deps.updateOrder).not.toHaveBeenCalled()
  })

  it('allows an editor to update Revenue on a histórico order', async () => {
    const deps = ordersDependencies({ fetchOrderById: vi.fn(async () => historicoDetailRow) })
    const response = await ordersApi(deps, null)
      .post('/api/orders/update')
      .set('x-user-role', 'editor')
      .send({ id: 202, patch: { ID_Tp_Revenue: 2 } })
    expect(response.status).toBe(200)
    expect(deps.updateOrder).toHaveBeenCalled()
  })

  it('allows an editor to toggle Order_Factory on a histórico order (not a locked field)', async () => {
    const deps = ordersDependencies({
      fetchOrderById: vi.fn(async () => historicoDetailRow),
    })
    const response = await ordersApi(deps, null)
      .post('/api/orders/update')
      .set('x-user-role', 'editor')
      .send({ id: 202, patch: { Order_Factory: true } })

    expect(response.status).toBe(200)
    expect(deps.updateOrder).toHaveBeenCalledWith(expect.anything(), 202, {
      Order_Factory: true,
      user: 'editor',
    })
  })

  it('allows an editor to update a non-locked field on a histórico order', async () => {
    const deps = ordersDependencies({
      fetchOrderById: vi.fn(async () => historicoDetailRow),
    })
    const response = await ordersApi(deps, null)
      .post('/api/orders/update')
      .set('x-user-role', 'editor')
      .send({ id: 202, patch: { Obs: 'late note' } })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, order: detailRow })
    expect(deps.updateOrder).toHaveBeenCalledWith(expect.anything(), 202, {
      Obs: 'late note',
      user: 'editor',
    })
  })

  it('allows an admin to update a locked field on a histórico order', async () => {
    const deps = ordersDependencies({
      fetchOrderById: vi.fn(async () => historicoDetailRow),
    })
    const response = await ordersApi(deps, null)
      .post('/api/orders/update')
      .set('x-user-role', 'admin')
      .send({ id: 202, patch: { Sell_Price: 9999 } })

    expect(response.status).toBe(200)
    expect(deps.updateOrder).toHaveBeenCalledWith(expect.anything(), 202, {
      Sell_Price: 9999,
      user: 'admin',
    })
  })

  it('allows an editor to update a locked field on a provisional order', async () => {
    const deps = ordersDependencies({
      fetchOrderById: vi.fn(async () => provisoriaDetailRow),
    })
    const response = await ordersApi(deps, null)
      .post('/api/orders/update')
      .set('x-user-role', 'editor')
      .send({ id: 303, patch: { Sell_Price: 9999 } })

    expect(response.status).toBe(200)
    expect(deps.updateOrder).toHaveBeenCalledWith(expect.anything(), 303, {
      Sell_Price: 9999,
      user: 'editor',
    })
  })

  it('returns 404 not-found when the order id does not exist', async () => {
    const deps = ordersDependencies({
      fetchOrderById: vi.fn(async () => null),
    })
    const response = await ordersApi(deps)
      .post('/api/orders/update')
      .send({ id: 999, patch: { Obs: 'x' } })

    expect(response.status).toBe(404)
    expect(response.body).toMatchObject({ ok: false, code: 'not-found' })
    expect(deps.updateOrder).not.toHaveBeenCalled()
  })

  it('strips unknown patch keys before they reach the db layer', async () => {
    const deps = ordersDependencies()
    const response = await ordersApi(deps, null)
      .post('/api/orders/update')
      .set('x-user-role', 'editor')
      .send({ id: 101, patch: { NotARealColumn: 'x' } })

    // zod strips unknown keys, so the request succeeds with an empty patch and the
    // unknown key never reaches updateOrder (defense in depth alongside the db whitelist).
    expect(response.status).toBe(200)
    expect(deps.updateOrder).toHaveBeenCalledWith(expect.anything(), 101, {
      user: 'editor',
    })
  })

  it('rejects a non-positive id as validation', async () => {
    const deps = ordersDependencies()
    const response = await ordersApi(deps).post('/api/orders/update').send({ id: 0, patch: {} })

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ ok: false, code: 'validation' })
    expect(deps.openPool).not.toHaveBeenCalled()
  })

  it('includes Provisoria in the detail payload and round-trips Orc_Proposta as a string', async () => {
    const deps = ordersDependencies()
    const response = await ordersApi(deps).get('/api/orders?id=101')

    expect(response.status).toBe(200)
    expect(response.body.order.Provisoria).toBe(false)
    expect(typeof response.body.order.Orc_Proposta).toBe('string')
    expect(response.body.order.Orc_Proposta).toBe('PROP-12000')
  })
})

describe('Orders create endpoint', () => {
  const validCreateBody = {
    DT_Order: '2026-08-25',
    ID_Tp_Order: 'C',
    ID_Client: 93,
    ID_Area: 'BDAL',
    ID_Tipo: 'INSTR',
    ID_Produto: 2,
    ID_Tp_Revenue: 1,
  }

  it('creates an order as editor and forwards the body to createOrder', async () => {
    const deps = ordersDependencies()
    const response = await ordersApi(deps, null)
      .post('/api/orders')
      .set('x-user-role', 'user')
      .send(validCreateBody)

    expect(response.status).toBe(201)
    expect(response.body).toEqual({ ok: true, order: detailRow })
    expect(deps.createOrder).toHaveBeenCalledWith(expect.anything(), validCreateBody, 'editor')
  })

  it('rejects a create without ID_Tp_Revenue as validation (revenue type is required)', async () => {
    const deps = ordersDependencies()
    const { ID_Tp_Revenue, ...withoutRevenue } = validCreateBody
    void ID_Tp_Revenue
    const response = await ordersApi(deps, null)
      .post('/api/orders')
      .set('x-user-role', 'user')
      .send(withoutRevenue)

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ ok: false, code: 'validation' })
    expect(deps.createOrder).not.toHaveBeenCalled()
  })

  it('maps a ClientNotFoundError from the db layer to a 400 validation response', async () => {
    const deps = ordersDependencies({
      createOrder: vi.fn(async () => {
        throw new ClientNotFoundError(999)
      }),
    })
    const response = await ordersApi(deps, null)
      .post('/api/orders')
      .set('x-user-role', 'user')
      .send({ ...validCreateBody, ID_Client: 999 })

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ ok: false, code: 'validation' })
    expect(response.body.message).toContain('999')
  })

  it('rejects a viewer with 403 forbidden', async () => {
    const deps = ordersDependencies()
    const response = await ordersApi(deps, null)
      .post('/api/orders')
      .set('x-user-role', 'viewer')
      .send(validCreateBody)

    expect(response.status).toBe(403)
    expect(deps.createOrder).not.toHaveBeenCalled()
  })
})

describe('Orders sub-table reads', () => {
  it('returns reconhecimento rows for a known orderId', async () => {
    const deps = ordersDependencies({
      fetchReconhecimentos: vi.fn(async () => reconhecimentoRows),
    })
    const response = await ordersApi(deps).get('/api/orders/reconhecimentos?orderId=101')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, rows: reconhecimentoRows })
    expect(deps.fetchReconhecimentos).toHaveBeenCalledWith(expect.anything(), 101)
    expect(deps.close).toHaveBeenCalledOnce()
  })

  it('returns an empty reconhecimento array for an unknown orderId', async () => {
    const deps = ordersDependencies({
      fetchReconhecimentos: vi.fn(async () => []),
    })
    const response = await ordersApi(deps).get('/api/orders/reconhecimentos?orderId=9999999')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, rows: [] })
  })

  it('returns facturacao rows for a known orderId', async () => {
    const deps = ordersDependencies({
      fetchFacturacao: vi.fn(async () => facturacaoRows),
    })
    const response = await ordersApi(deps).get('/api/orders/facturacao?orderId=101')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, rows: facturacaoRows })
    expect(deps.fetchFacturacao).toHaveBeenCalledWith(expect.anything(), 101)
  })

  it('returns live Tp_Doc_FT options with descriptive labels', async () => {
    const deps = ordersDependencies()
    const response = await ordersApi(deps).get('/api/orders/facturacao/types')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, types: documentTypes })
    expect(deps.fetchFacturacaoTypes).toHaveBeenCalledWith(expect.anything())
  })

  it('returns an empty facturacao array for an unknown orderId', async () => {
    const deps = ordersDependencies({
      fetchFacturacao: vi.fn(async () => []),
    })
    const response = await ordersApi(deps).get('/api/orders/facturacao?orderId=9999999')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, rows: [] })
  })

  it('rejects a missing orderId query parameter', async () => {
    const deps = ordersDependencies()
    const response = await ordersApi(deps).get('/api/orders/reconhecimentos')

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ ok: false, code: 'validation' })
    expect(deps.openPool).not.toHaveBeenCalled()
  })

  it('rejects a non-positive orderId', async () => {
    const deps = ordersDependencies()
    const response = await ordersApi(deps).get('/api/orders/reconhecimentos?orderId=0')

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ ok: false, code: 'validation' })
    expect(deps.openPool).not.toHaveBeenCalled()
  })

  it('maps a missing orders profile to 502 orders-not-configured', async () => {
    const deps = ordersDependencies({
      resolveOrdersProfile: vi.fn(() => {
        throw new OrdersProfileNotConfiguredError(
          'No database connection profile is configured for the Orders endpoint.',
        )
      }),
    })
    const response = await ordersApi(deps).get('/api/orders/reconhecimentos?orderId=101')

    expect(response.status).toBe(502)
    expect(response.body).toEqual({
      ok: false,
      code: 'orders-not-configured',
      message: 'No database connection profile is configured for the Orders endpoint.',
    })
    expect(deps.openPool).not.toHaveBeenCalled()
  })

  it('allows tokenless access on loopback when no admin token is configured', async () => {
    const deps = ordersDependencies({
      fetchFacturacao: vi.fn(async () => facturacaoRows),
    })
    const response = await ordersApi(deps, null).get('/api/orders/facturacao?orderId=101')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, rows: facturacaoRows })
  })
})

describe('Orders sub-table mutations', () => {
  it('updates a recognition row and stamps the acting role server-side', async () => {
    const deps = ordersDependencies()
    const patch = {
      ID_Tp_Reconhecimento: 'WP',
      DT_Reconhecimento: '2027-01-01T00:00:00Z',
      Valor_Reconhecimento: 500,
    }
    const response = await ordersApi(deps)
      .post('/api/orders/reconhecimentos/update')
      .set('x-user-role', 'admin')
      .send({ id: 1, patch })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, row: reconhecimentoRows[0] })
    expect(deps.updateReconhecimento).toHaveBeenCalledWith(expect.anything(), 1, patch, 'admin')
  })

  it('hard-deletes a recognition row and returns 404 when it does not exist', async () => {
    const found = ordersDependencies()
    const deleted = await ordersApi(found)
      .post('/api/orders/reconhecimentos/delete')
      .send({ id: 1 })

    expect(deleted.status).toBe(200)
    expect(deleted.body).toEqual({ ok: true })
    expect(found.deleteReconhecimento).toHaveBeenCalledWith(expect.anything(), 1)

    const missing = ordersDependencies({ deleteReconhecimento: vi.fn(async () => false) })
    const notFound = await ordersApi(missing)
      .post('/api/orders/reconhecimentos/delete')
      .send({ id: 999 })
    expect(notFound.status).toBe(404)
    expect(notFound.body).toMatchObject({ ok: false, code: 'not-found' })
  })

  it('propagates maintenance inputs and returns all generated rows', async () => {
    const deps = ordersDependencies()
    const response = await ordersApi(deps, null)
      .post('/api/orders/reconhecimentos/propagate')
      .set('x-user-role', 'editor')
      .send({
        orderId: 101,
        kind: 'maintenance',
        startDate: '2027-02-18',
        years: 2,
        recognitionDate: '2027-06-21',
      })

    expect(response.status).toBe(201)
    expect(response.body).toEqual({ ok: true, rows: reconhecimentoRows })
    expect(deps.propagateReconhecimento).toHaveBeenCalledWith(
      expect.anything(),
      {
        orderId: 101,
        kind: 'maintenance',
        startDate: '2027-02-18',
        years: 2,
        recognitionDate: '2027-06-21',
      },
      'editor',
    )
  })

  it('rejects maintenance propagation without a recognition date', async () => {
    const deps = ordersDependencies()
    const response = await ordersApi(deps, null)
      .post('/api/orders/reconhecimentos/propagate')
      .set('x-user-role', 'editor')
      .send({
        orderId: 101,
        kind: 'maintenance',
        startDate: '2027-02-18',
        years: 2,
      })

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ ok: false, code: 'validation' })
    expect(deps.propagateReconhecimento).not.toHaveBeenCalled()
    expect(deps.openPool).not.toHaveBeenCalled()
  })

  it('rejects viewers for every recognition mutation before opening a pool', async () => {
    const deps = ordersDependencies()
    const update = await ordersApi(deps, null)
      .post('/api/orders/reconhecimentos/update')
      .set('x-user-role', 'viewer')
      .send({ id: 1, patch: { Valor_Reconhecimento: 1 } })
    const remove = await ordersApi(deps, null)
      .post('/api/orders/reconhecimentos/delete')
      .set('x-user-role', 'viewer')
      .send({ id: 1 })
    const propagate = await ordersApi(deps, null)
      .post('/api/orders/reconhecimentos/propagate')
      .set('x-user-role', 'viewer')
      .send({ orderId: 101, kind: 'warranty' })

    expect([update.status, remove.status, propagate.status]).toEqual([403, 403, 403])
    expect(deps.updateReconhecimento).not.toHaveBeenCalled()
    expect(deps.deleteReconhecimento).not.toHaveBeenCalled()
    expect(deps.propagateReconhecimento).not.toHaveBeenCalled()
    expect(deps.openPool).not.toHaveBeenCalled()
  })

  it('returns a stable 422 capacity error without hiding the business message', async () => {
    const deps = ordersDependencies({
      updateReconhecimento: vi.fn(async () => {
        throw new RecognitionCapacityError('O total reconhecido não pode ultrapassar o Sell Price.')
      }),
    })
    const response = await ordersApi(deps)
      .post('/api/orders/reconhecimentos/update')
      .send({ id: 1, patch: { Valor_Reconhecimento: 999999 } })

    expect(response.status).toBe(422)
    expect(response.body).toEqual({
      ok: false,
      code: 'capacity-exceeded',
      message: 'O total reconhecido não pode ultrapassar o Sell Price.',
    })
  })

  it('updates and deletes invoicing documents', async () => {
    const deps = ordersDependencies()
    const patch = {
      ID_Tp_Doc_FT: 'NC',
      N_Doc_FT: 'NC 2027/1',
      Valor_Doc_FT: -100,
    }
    const updated = await ordersApi(deps, null)
      .post('/api/orders/facturacao/update')
      .set('x-user-role', 'editor')
      .send({ id: 1, patch })
    const deleted = await ordersApi(deps, null)
      .post('/api/orders/facturacao/delete')
      .set('x-user-role', 'editor')
      .send({ id: 1 })

    expect(updated.status).toBe(200)
    expect(updated.body).toEqual({ ok: true, row: facturacaoRows[0] })
    expect(deps.updateFacturacao).toHaveBeenCalledWith(expect.anything(), 1, patch, 'editor')
    expect(deleted.status).toBe(200)
    expect(deps.deleteFacturacao).toHaveBeenCalledWith(expect.anything(), 1)
  })

  it('rejects viewers for invoicing mutations', async () => {
    const deps = ordersDependencies()
    const updated = await ordersApi(deps, null)
      .post('/api/orders/facturacao/update')
      .set('x-user-role', 'viewer')
      .send({ id: 1, patch: { Valor_Doc_FT: 1 } })
    const deleted = await ordersApi(deps, null)
      .post('/api/orders/facturacao/delete')
      .set('x-user-role', 'viewer')
      .send({ id: 1 })

    expect([updated.status, deleted.status]).toEqual([403, 403])
    expect(deps.updateFacturacao).not.toHaveBeenCalled()
    expect(deps.deleteFacturacao).not.toHaveBeenCalled()
  })
})

describe('Kit_Consumables sub-table', () => {
  it('returns kit consumable rows for a known orderId', async () => {
    const deps = ordersDependencies({
      fetchKitConsumables: vi.fn(async () => kitConsumableRows),
    })
    const response = await ordersApi(deps).get('/api/orders/kit-consumables?orderId=101')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, rows: kitConsumableRows })
    expect(deps.fetchKitConsumables).toHaveBeenCalledWith(expect.anything(), 101)
    expect(deps.close).toHaveBeenCalledOnce()
  })

  it('returns an empty kit consumable array for an unknown orderId', async () => {
    const deps = ordersDependencies({
      fetchKitConsumables: vi.fn(async () => []),
    })
    const response = await ordersApi(deps).get('/api/orders/kit-consumables?orderId=9999999')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, rows: [] })
  })

  it('rejects a missing orderId query parameter', async () => {
    const deps = ordersDependencies()
    const response = await ordersApi(deps).get('/api/orders/kit-consumables')

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ ok: false, code: 'validation' })
    expect(deps.openPool).not.toHaveBeenCalled()
  })

  it('adds a kit consumable row', async () => {
    const deps = ordersDependencies()
    const body = {
      ID_Order: 101,
      Date: '2026-08-23T00:00:00Z',
      Internal_Order: 'INT-2',
      Material: 'MAT-B',
      Description: 'Column',
      Quant: 1,
      Unit_Price: 100,
      Total_Price: 100,
    }
    const response = await ordersApi(deps, null)
      .post('/api/orders/kit-consumables')
      .set('x-user-role', 'editor')
      .send(body)

    expect(response.status).toBe(201)
    expect(response.body).toEqual({ ok: true, row: kitConsumableRows[0] })
    expect(deps.addKitConsumable).toHaveBeenCalledWith(expect.anything(), body)
  })

  it('updates a kit consumable row', async () => {
    const deps = ordersDependencies()
    const patch = { Quant: 3, Unit_Price: 125, Total_Price: 375 }
    const response = await ordersApi(deps)
      .post('/api/orders/kit-consumables/update')
      .send({ id: 1, patch })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, row: kitConsumableRows[0] })
    expect(deps.updateKitConsumable).toHaveBeenCalledWith(expect.anything(), 1, patch)
  })

  it('returns 404 when updating a missing kit consumable', async () => {
    const deps = ordersDependencies({
      updateKitConsumable: vi.fn(async () => null),
    })
    const response = await ordersApi(deps)
      .post('/api/orders/kit-consumables/update')
      .send({ id: 999, patch: { Quant: 1 } })

    expect(response.status).toBe(404)
    expect(response.body).toMatchObject({ ok: false, code: 'not-found' })
  })

  it('hard-deletes a kit consumable row and returns 404 when it does not exist', async () => {
    const found = ordersDependencies()
    const deleted = await ordersApi(found)
      .post('/api/orders/kit-consumables/delete')
      .send({ id: 1 })

    expect(deleted.status).toBe(200)
    expect(deleted.body).toEqual({ ok: true })
    expect(found.deleteKitConsumable).toHaveBeenCalledWith(expect.anything(), 1)

    const missing = ordersDependencies({ deleteKitConsumable: vi.fn(async () => false) })
    const notFound = await ordersApi(missing)
      .post('/api/orders/kit-consumables/delete')
      .send({ id: 999 })
    expect(notFound.status).toBe(404)
    expect(notFound.body).toMatchObject({ ok: false, code: 'not-found' })
  })

  it('rejects viewers for kit consumable mutations before opening a pool', async () => {
    const deps = ordersDependencies()
    const add = await ordersApi(deps, null)
      .post('/api/orders/kit-consumables')
      .set('x-user-role', 'viewer')
      .send({
        ID_Order: 101,
        Date: '2026-08-23T00:00:00Z',
        Internal_Order: 'INT',
        Material: 'M',
        Description: 'D',
        Quant: 1,
        Unit_Price: 1,
        Total_Price: 1,
      })
    const update = await ordersApi(deps, null)
      .post('/api/orders/kit-consumables/update')
      .set('x-user-role', 'viewer')
      .send({ id: 1, patch: { Quant: 1 } })
    const remove = await ordersApi(deps, null)
      .post('/api/orders/kit-consumables/delete')
      .set('x-user-role', 'viewer')
      .send({ id: 1 })

    expect([add.status, update.status, remove.status]).toEqual([403, 403, 403])
    expect(deps.addKitConsumable).not.toHaveBeenCalled()
    expect(deps.updateKitConsumable).not.toHaveBeenCalled()
    expect(deps.deleteKitConsumable).not.toHaveBeenCalled()
    expect(deps.openPool).not.toHaveBeenCalled()
  })

  it('rejects an invalid kit consumable create body', async () => {
    const deps = ordersDependencies()
    const response = await ordersApi(deps, null)
      .post('/api/orders/kit-consumables')
      .set('x-user-role', 'editor')
      .send({ ID_Order: 101, Date: '2026-08-23T00:00:00Z' })

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ ok: false, code: 'validation' })
    expect(deps.addKitConsumable).not.toHaveBeenCalled()
  })
})
