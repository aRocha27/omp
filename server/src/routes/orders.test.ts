import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ConnectionPool } from 'mssql'
import { createApp, type AppDependencies } from '../app.js'
import { OrdersProfileNotConfiguredError } from '../profiles.js'
import type {
  ConnectionConfig,
  DocumentoFaturacaoRow,
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
  Provisoria: false,
}

const detailRow: OrderDetailRow = {
  ...summaryRow,
  Orc_Proposta: 'PROP-12000',
  PO_Cliente: 'PO-1',
  ID_Tp_Warranty: 2,
  Warranty_Reserve: 500,
  Warranty_DT_Inicio: '2026-01-01T00:00:00Z',
  ID_Tp_Revenue: 1,
  Facturado: false,
  Reconhecido: false,
  Cod_Enc_Fornecedor: 'SUP-1',
  Obs: 'Approved',
  ID_User: 'arocha',
  DT_User: '2026-08-23T00:00:00Z',
  Kit: false,
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
    updateOrder: vi.fn(async () => detailRow),
    createOrder: vi.fn(async () => detailRow),
    fetchReconhecimentos: vi.fn(async () => []),
    fetchFacturacao: vi.fn(async () => []),
    addReconhecimento: vi.fn(async () => reconhecimentoRows[0]),
    addFacturacao: vi.fn(async () => facturacaoRows[0]),
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
    const response = await ordersApi(deps)
      .post('/api/orders/list')
      .send({ filters, limit: 50 })

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
    const response = await ordersApi(deps)
      .post('/api/orders/update')
      .send({ id: 101, patch: { Obs: 'Revised note' } })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, order: detailRow })
    expect(deps.fetchOrderById).toHaveBeenCalledWith(expect.anything(), 101)
    // The route falls back to the dev role ('editor') when no user is supplied.
    expect(deps.updateOrder).toHaveBeenCalledWith(expect.anything(), 101, {
      Obs: 'Revised note',
      user: 'editor',
    })
  })

  it('rejects a viewer with 403 forbidden', async () => {
    const deps = ordersDependencies()
    const response = await ordersApi(deps)
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
    const response = await ordersApi(deps)
      .post('/api/orders/update')
       .send({ id: 202, patch: { ID_Area: 'NEW' } })

    expect(response.status).toBe(403)
    expect(response.body).toMatchObject({ ok: false, code: 'field-locked' })
    expect(response.body.message).toContain('ID_Area')
    expect(deps.updateOrder).not.toHaveBeenCalled()
  })

  it('allows an editor to update Revenue on a histórico order', async () => {
    const deps = ordersDependencies({ fetchOrderById: vi.fn(async () => historicoDetailRow) })
    const response = await ordersApi(deps).post('/api/orders/update').send({ id: 202, patch: { ID_Tp_Revenue: 2 } })
    expect(response.status).toBe(200)
    expect(deps.updateOrder).toHaveBeenCalled()
  })

  it('allows an editor to update a non-locked field on a histórico order', async () => {
    const deps = ordersDependencies({
      fetchOrderById: vi.fn(async () => historicoDetailRow),
    })
    const response = await ordersApi(deps)
      .post('/api/orders/update')
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
    const response = await ordersApi(deps)
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
    const response = await ordersApi(deps)
      .post('/api/orders/update')
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
    const response = await ordersApi(deps)
      .post('/api/orders/update')
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
    const response = await ordersApi(deps)
      .post('/api/orders/update')
      .send({ id: 0, patch: {} })

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
