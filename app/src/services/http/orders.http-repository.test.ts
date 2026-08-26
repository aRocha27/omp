/**
 * Unit tests for HttpOrdersRepository.
 *
 * Global `fetch` is mocked — no network. Covers the two read endpoints, the
 * null-detail contract, and the failure → RepositoryError mapping (401/403 →
 * forbidden, 404 → not-found, everything else → server-error).
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { HttpOrdersRepository } from '@/services/http/orders.http-repository'
import { RepositoryError } from '@/services/contracts/orders.repository'
import type { Order, OrderSummary } from '@/domain/models/order'

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

const summaryRow: OrderSummary = {
  ID_Order: 1001,
  DT_Order: '2025-09-12',
  Order_Factory: false,
  ID_Tp_Order: 'C',
  Provisoria: false,
  ID_Client: 501,
  Client_Name: 'Client Alpha',
  ID_Area: 'BDAL',
  ID_Tipo: 'INSTR',
  ID_Produto: 1,
  ID_Instrumento: 8,
  Sell_Price: 48500,
  Negocio_Fechado: false,
  Encomenda_Cli_PHC: 'PHC-1001',
  Kit: false,
  ID_Tp_Warranty: 1,
  Warranty_Reserve: 1455,
  Warranty_DT_Inicio: '2025-09-12',
  Orc_Proposta: 'ORC-1001',
  PO_Cliente: 'PO-1',
  ID_Tp_Revenue: 1,
}

const detailRow: Order = {
  ID_Order: 1001,
  DT_Order: '2025-09-12',
  Order_Factory: false,
  ID_Tp_Order: 'C',
  Provisoria: false,
  Encomenda_Cli_PHC: 'PHC-1001',
  ID_Client: 501,
  Client_Name: 'Client Alpha',
  ID_Area: 'BDAL',
  ID_Tipo: 'INSTR',
  Tipo_Warranty: true,
  ID_Produto: 1,
  ID_Instrumento: 8,
  Orc_Proposta: 'ORC-1001',
  PO_Cliente: 'PO-1',
  Sell_Price: 48500,
  ID_Tp_Warranty: 1,
  Warranty_Reserve: 1455,
  Warranty_DT_Inicio: '2025-09-12',
  ID_Tp_Revenue: 1,
  Facturado: false,
  Reconhecido: false,
  Cod_Enc_Fornecedor: 'F-1',
  Obs: 'note',
  Negocio_Fechado: false,
  ID_User: 'alice',
  DT_User: '2025-09-12',
  upsize_ts: null,
  Kit: false,
  Kit_Amount: null,
  Contacto: '+351',
  Email: null,
}

describe('HttpOrdersRepository', () => {
  let repo: HttpOrdersRepository
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    repo = new HttpOrdersRepository()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('search', () => {
    it('POSTs to /orders/list with normalised filters and limit 200, returns summaries', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, { ok: true, orders: [summaryRow] }),
      )

      const rows = await repo.search({ idArea: ['BDAL'], idProduto: [1] })

      expect(rows).toEqual([summaryRow])
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('/api/orders/list')
      expect(init?.method).toBe('POST')
      // normaliseOrderFilters strips null/''/empty arrays; only set filters survive on the wire.
      expect(JSON.parse(init?.body)).toEqual({
        filters: { idArea: ['BDAL'], idProduto: [1] },
        limit: 200,
      })
    })

    it('sends an empty filters object when no filters are set', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, orders: [] }))

      const rows = await repo.search({})

      expect(rows).toEqual([])
      const init = fetchMock.mock.calls[0][1] as RequestInit
      expect(JSON.parse(init.body as string)).toEqual({ filters: {}, limit: 200 })
    })

    it('maps an orders-not-configured failure to a server-error RepositoryError', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(502, { ok: false, code: 'orders-not-configured', message: 'No orders profile.' }),
      )

      const error = await repo.search({}).catch((e) => e)
      expect(error).toBeInstanceOf(RepositoryError)
      expect(error).toMatchObject({ kind: 'server-error', message: 'No orders profile.' })
    })

    it('maps a 500 to a server-error RepositoryError', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(500, { ok: false, code: 'internal', message: 'boom' }),
      )

      await expect(repo.search({})).rejects.toMatchObject({ kind: 'server-error', message: 'boom' })
    })

    it('maps a 401/403 to a forbidden RepositoryError', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(401, { ok: false, code: 'unauthorized', message: 'no token' }),
      )

      await expect(repo.search({})).rejects.toMatchObject({ kind: 'forbidden', message: 'no token' })
    })

    it('maps a network failure to a server-error RepositoryError', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network down'))

      await expect(repo.search({})).rejects.toMatchObject({ kind: 'server-error' })
    })
  })

  describe('getById', () => {
    it('GETs /orders?id=N and returns the mapped Order', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, order: detailRow }))

      const order = await repo.getById(1001)

      expect(order).toEqual(detailRow)
      expect(fetchMock.mock.calls[0][0]).toBe('/api/orders?id=1001')
      const init = fetchMock.mock.calls[0][1] as RequestInit
      expect(init?.method).toBe('GET')
    })

    it('returns null when the order is absent (200, order: null)', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, order: null }))

      expect(await repo.getById(9999999)).toBeNull()
    })

    it('strips upsize_ts to null and Email to null on the live row', async () => {
      // Simulate a row that erroneously carries upsize_ts (the backend strips it,
      // but the mapper must still null it so a Buffer never reaches the UI).
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, {
          ok: true,
          order: { ...detailRow, upsize_ts: 'should-not-survive', Email: 'should-not-survive@x' },
        }),
      )

      const order = await repo.getById(1001)
      expect(order?.upsize_ts).toBeNull()
      expect(order?.Email).toBeNull()
    })

    it('maps a 404 failure to a not-found RepositoryError', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(404, { ok: false, code: 'not-found', message: 'no such order' }),
      )

      await expect(repo.getById(42)).rejects.toMatchObject({ kind: 'not-found', message: 'no such order' })
    })
  })

  describe('update', () => {
    it('POSTs to /orders/update with { id, patch, user } and the X-User-Role header, returns the mapped Order', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, order: detailRow }))

      const patch = { Sell_Price: 51000, Obs: 'updated note' }
      const order = await repo.update(1001, patch, 'admin')

      expect(order).toEqual(detailRow)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('/api/orders/update')
      expect(init?.method).toBe('POST')
      // Patch fields are sent verbatim — no case conversion (legacy identifiers preserved).
      expect(JSON.parse(init?.body as string)).toEqual({ id: 1001, patch })
      // The role is also forwarded as a header so the backend can enforce field locks.
      const headers = (init?.headers ?? {}) as Record<string, string>
      expect(headers['Content-Type']).toBe('application/json')
      expect(headers['X-User-Role']).toBe('admin')
    })

    it('maps a 403 field-locked failure to a forbidden RepositoryError', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(403, { ok: false, code: 'field-locked', message: 'Sell_Price is locked for viewers.' }),
      )

      await expect(repo.update(1001, { Sell_Price: 1 }, 'viewer')).rejects.toMatchObject({
        kind: 'forbidden',
        message: 'Sell_Price is locked for viewers.',
      })
    })

    it('maps a 403 forbidden failure to a forbidden RepositoryError', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(403, { ok: false, code: 'forbidden', message: 'role not allowed.' }),
      )

      await expect(repo.update(1001, { Obs: 'x' }, 'viewer')).rejects.toMatchObject({
        kind: 'forbidden',
        message: 'role not allowed.',
      })
    })

    it('maps a 404 failure to a not-found RepositoryError', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(404, { ok: false, code: 'not-found', message: 'no such order' }),
      )

      await expect(repo.update(42, { Obs: 'x' }, 'editor')).rejects.toMatchObject({
        kind: 'not-found',
        message: 'no such order',
      })
    })
  })
})
