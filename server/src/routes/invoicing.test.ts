import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ConnectionPool } from 'mssql'
import { createApp, type AppDependencies } from '../app.js'
import type { ConnectionConfig } from '../types.js'

const credentials: ConnectionConfig = {
  server: 'sql-orders.internal',
  port: 1433,
  database: 'OMP_DEMO',
  user: 'omp_demo_user',
  password: 'never-log-this-password',
}

function invoicingDependencies(overrides: Partial<AppDependencies> = {}) {
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
      kpis: { ordersBookedYtd: 0, amountToInvoice: 0, nobYtd: 0, revenueRecognizedYtd: 0, backlogToRecognize: 0, backlogAtPeriodStart: 0 },
      monthlyTrend: [],
      recognitionQueue: [],
      warrantyMissing: [],
      notFullyInvoiced: [],
      recentOrders: [],
    })),
    fetchRecognitionQueue: vi.fn(async () => []),
    fetchRecognitionReport: vi.fn(async () => []),
    fetchRecognitionReportOptions: vi.fn(async () => ({ years: [], areas: [], grpReports: [], tipos: [], produtos: [], encomendas: [], tpReconhecimentos: [] })),
    fetchInvoicingSnapshot: vi.fn(async () => ({ amountToInvoice: 10, notFullyInvoiced: [], warrantyMissing: [] })),
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
    fetchAreas: vi.fn(async () => []),
    fetchProdutos: vi.fn(async () => []),
    fetchInstrumentos: vi.fn(async () => []),
    close,
    ...overrides,
  }
  return values
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Invoicing API', () => {
  it('returns the invoicing snapshot through the managed profile', async () => {
    const deps = invoicingDependencies()
    const response = await request(createApp(deps, { token: null })).get('/api/invoicing')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      ok: true,
      invoicing: { amountToInvoice: 10, notFullyInvoiced: [], warrantyMissing: [] },
    })
    expect(deps.fetchInvoicingSnapshot).toHaveBeenCalledWith(expect.anything())
  })
})
