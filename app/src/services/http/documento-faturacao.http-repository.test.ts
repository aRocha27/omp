/**
 * Unit tests for HttpDocumentoFaturacaoRepository.
 *
 * Global `fetch` is mocked — no network. Mirrors the other http-repository tests:
 * covers the live read endpoint, the `add`-not-supported contract, and the
 * failure → RepositoryError mapping (401/403 → forbidden, 404 → not-found,
 * 500/not-configured → server-error, network → server-error).
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { HttpDocumentoFaturacaoRepository } from '@/services/http/documento-faturacao.http-repository'
import { RepositoryError } from '@/services/contracts/documento-faturacao.repository'
import type { DocumentoFaturacao } from '@/domain/models/documento-faturacao'

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

const row: DocumentoFaturacao = {
  ID_Facturacao: 21,
  ID_Order: 1002,
  DT_Doc_FT: '2025-10-01T00:00:00.000Z',
  ID_Tp_Doc_FT: 'FT',
  N_Doc_FT: 'A22',
  Valor_Doc_FT: 66000,
  ID_User: 'dev',
  DT_User: '2025-10-01T00:00:00.000Z',
}

describe('HttpDocumentoFaturacaoRepository', () => {
  let repo: HttpDocumentoFaturacaoRepository
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    repo = new HttpDocumentoFaturacaoRepository()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('listTypes', () => {
    it('GETs the live Tp_Doc_FT endpoint and returns descriptive options', async () => {
      const types = [
        { id: 'AcFT', label: 'Invoice Adjustment' },
        { id: 'FT', label: 'Invoice' },
        { id: 'NC', label: 'Credit Note' },
      ]
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, types }))

      await expect(repo.listTypes()).resolves.toEqual(types)
      expect(fetchMock.mock.calls[0][0]).toBe('/api/orders/facturacao/types')
      expect((fetchMock.mock.calls[0][1] as RequestInit)?.method).toBe('GET')
    })
  })

  describe('listByOrder', () => {
    it('GETs /orders/facturacao?orderId=N and returns the mapped rows', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, rows: [row] }))

      const rows = await repo.listByOrder(1002)

      expect(rows).toEqual([row])
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0][0]).toBe('/api/orders/facturacao?orderId=1002')
      const init = fetchMock.mock.calls[0][1] as RequestInit
      expect(init?.method).toBe('GET')
    })

    it('returns an empty list when the order has no documents', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, rows: [] }))

      expect(await repo.listByOrder(99999)).toEqual([])
    })

    it('maps an orders-not-configured failure (502) to a server-error RepositoryError', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(502, { ok: false, code: 'orders-not-configured', message: 'No orders profile.' }),
      )

      const error = await repo.listByOrder(1002).catch((e) => e)
      expect(error).toBeInstanceOf(RepositoryError)
      expect(error).toMatchObject({ kind: 'server-error', message: 'No orders profile.' })
    })

    it('maps a 500 to a server-error RepositoryError', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(500, { ok: false, code: 'internal', message: 'boom' }))

      await expect(repo.listByOrder(1002)).rejects.toMatchObject({
        kind: 'server-error',
        message: 'boom',
      })
    })

    it('maps a 401 unauthorized to a forbidden RepositoryError', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(401, { ok: false, code: 'unauthorized', message: 'no token' }))

      await expect(repo.listByOrder(1002)).rejects.toMatchObject({
        kind: 'forbidden',
        message: 'no token',
      })
    })

    it('maps a 403 forbidden to a forbidden RepositoryError', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(403, { ok: false, code: 'forbidden', message: 'role not allowed.' }))

      await expect(repo.listByOrder(1002)).rejects.toMatchObject({
        kind: 'forbidden',
        message: 'role not allowed.',
      })
    })

    it('maps a network failure to a server-error RepositoryError', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network down'))

      await expect(repo.listByOrder(1002)).rejects.toMatchObject({ kind: 'server-error' })
    })

    it('falls back to a generic message when the body is not an ApiFailure', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(500, null))

      await expect(repo.listByOrder(1002)).rejects.toMatchObject({
        kind: 'server-error',
        message: 'The database service returned an unexpected error.',
      })
    })
  })

  describe('add', () => {
    it('posts a new invoice document', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(201, { ok: true, row }))
      await expect(
        repo.add({
          ID_Order: 1002,
          DT_Doc_FT: '2025-10-01T00:00:00.000Z',
          ID_Tp_Doc_FT: 'FT',
          N_Doc_FT: 'A22',
          Valor_Doc_FT: 66000,
          ID_User: 'dev',
        }, 'editor'),
      ).resolves.toEqual(row)
      expect(fetchMock).toHaveBeenCalledOnce()
    })
  })

  describe('update', () => {
    it('POSTs {id, patch} to /orders/facturacao/update and returns the row', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, row }))
      await expect(repo.update(1, { ID_Tp_Doc_FT: 'NC' }, 'editor')).resolves.toEqual(row)
      const init = fetchMock.mock.calls[0][1] as RequestInit
      expect(init?.method).toBe('POST')
      expect(init?.body).toBe(JSON.stringify({ id: 1, patch: { ID_Tp_Doc_FT: 'NC' } }))
    })

    it('maps a net-exceeding 422 to a server-error RepositoryError', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(422, { ok: false, code: 'validation', message: 'Net invoiced > Sell Price.' }),
      )
      await expect(repo.update(1, { Valor_Doc_FT: 999999 }, 'editor')).rejects.toMatchObject({
        kind: 'server-error',
        message: 'Net invoiced > Sell Price.',
      })
    })
  })

  describe('remove', () => {
    it('POSTs {id} to /orders/facturacao/delete and resolves', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }))
      await expect(repo.remove(1, 'editor')).resolves.toBeUndefined()
      const init = fetchMock.mock.calls[0][1] as RequestInit
      expect(init?.body).toBe(JSON.stringify({ id: 1 }))
    })
  })
})
