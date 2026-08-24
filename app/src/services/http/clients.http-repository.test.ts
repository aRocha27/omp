/**
 * Unit tests for HttpClientsRepository.
 *
 * Global `fetch` is mocked — no network. Mirrors `orders.http-repository.test.ts`:
 * covers the two read endpoints, the null-detail contract, and the failure →
 * RepositoryError mapping (502 not-configured → server-error, 401/403 → forbidden,
 * 404 → not-found, network → server-error).
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { HttpClientsRepository } from '@/services/http/clients.http-repository'
import { RepositoryError } from '@/services/contracts/clients.repository'
import type { Client, ClientSummary } from '@/domain/models/client'

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

const summaryRow: ClientSummary = {
  ID_Cliente: 501,
  no_PHC: 7701,
  ID_Tp_Cliente: 1,
  nome: 'Client Alpha',
  ncont: 'PT500123456',
  telefone: '+351210000000',
  local: 'Lisbon',
}

const detailRow: Client = {
  ID_Cliente: 501,
  no_PHC: 7701,
  ID_Tp_Cliente: 1,
  nome: 'Client Alpha',
  ncont: 'PT500123456',
  fax: '+351210000001',
  telefone: '+351210000000',
  contacto: 'Jane Doe',
  morada: 'Rua Maior 1',
  local: 'Lisbon',
  codpost: '1000-100',
  zona: 'Sul',
  Defense: false,
}

describe('HttpClientsRepository', () => {
  let repo: HttpClientsRepository
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    repo = new HttpClientsRepository()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('search', () => {
    it('POSTs to /clients/list with normalised filters and limit 200, returns summaries', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, clients: [summaryRow] }))

      const rows = await repo.search({ search: 'alpha', idTpCliente: [1, 2] })

      expect(rows).toEqual([summaryRow])
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('/api/clients/list')
      expect(init?.method).toBe('POST')
      // normaliseClientFilters trims/strips empty values; set filters survive on the wire.
      expect(JSON.parse(init?.body)).toEqual({
        filters: { search: 'alpha', idTpCliente: [1, 2] },
        limit: 200,
      })
    })

    it('sends an empty filters object when no filters are set', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, clients: [] }))

      const rows = await repo.search({ search: '', idTpCliente: [] })

      expect(rows).toEqual([])
      const init = fetchMock.mock.calls[0][1] as RequestInit
      expect(JSON.parse(init.body as string)).toEqual({ filters: {}, limit: 200 })
    })

    it('strips a whitespace-only search but keeps a populated idTpCliente', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, clients: [] }))

      await repo.search({ search: '   ', idTpCliente: [3] })

      const init = fetchMock.mock.calls[0][1] as RequestInit
      expect(JSON.parse(init.body as string)).toEqual({ filters: { idTpCliente: [3] }, limit: 200 })
    })

    it('maps a clients-not-configured failure (502) to a server-error RepositoryError', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(502, { ok: false, code: 'clients-not-configured', message: 'No clients profile.' }),
      )

      const error = await repo.search({ search: '', idTpCliente: [] }).catch((e) => e)
      expect(error).toBeInstanceOf(RepositoryError)
      expect(error).toMatchObject({ kind: 'server-error', message: 'No clients profile.' })
    })

    it('maps a 500 to a server-error RepositoryError', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(500, { ok: false, code: 'internal', message: 'boom' }),
      )

      await expect(repo.search({ search: '', idTpCliente: [] })).rejects.toMatchObject({
        kind: 'server-error',
        message: 'boom',
      })
    })

    it('maps a 401/403 to a forbidden RepositoryError', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(401, { ok: false, code: 'unauthorized', message: 'no token' }),
      )

      await expect(repo.search({ search: '', idTpCliente: [] })).rejects.toMatchObject({
        kind: 'forbidden',
        message: 'no token',
      })
    })

    it('maps a network failure to a server-error RepositoryError', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network down'))

      await expect(repo.search({ search: '', idTpCliente: [] })).rejects.toMatchObject({
        kind: 'server-error',
      })
    })
  })

  describe('getById', () => {
    it('GETs /clients?id=N and returns the mapped Client', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, client: detailRow }))

      const client = await repo.getById(501)

      expect(client).toEqual(detailRow)
      expect(fetchMock.mock.calls[0][0]).toBe('/api/clients?id=501')
      const init = fetchMock.mock.calls[0][1] as RequestInit
      expect(init?.method).toBe('GET')
    })

    it('returns null when the client is absent (200, client: null)', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, client: null }))

      expect(await repo.getById(9999999)).toBeNull()
    })

    it('maps a 404 failure to a not-found RepositoryError', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(404, { ok: false, code: 'not-found', message: 'no such client' }),
      )

      await expect(repo.getById(42)).rejects.toMatchObject({
        kind: 'not-found',
        message: 'no such client',
      })
    })

    it('maps a 403 forbidden failure to a forbidden RepositoryError', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(403, { ok: false, code: 'forbidden', message: 'role not allowed.' }),
      )

      await expect(repo.getById(42)).rejects.toMatchObject({
        kind: 'forbidden',
        message: 'role not allowed.',
      })
    })
  })
})