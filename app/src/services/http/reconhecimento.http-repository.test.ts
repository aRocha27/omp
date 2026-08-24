/**
 * Unit tests for HttpReconhecimentoRepository.
 *
 * Global `fetch` is mocked — no network. Mirrors the other http-repository tests:
  * covers the live read and write endpoints, and the
 * failure → RepositoryError mapping (401/403 → forbidden, 404 → not-found,
 * 500/not-configured → server-error, network → server-error).
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { HttpReconhecimentoRepository } from '@/services/http/reconhecimento.http-repository'
import { RepositoryError } from '@/services/contracts/reconhecimento.repository'
import type { Reconhecimento } from '@/domain/models/reconhecimento'

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

const row: Reconhecimento = {
  ID_Reconhecimento: 11,
  ID_Order: 1001,
  ID_Tp_Reconhecimento: 'P',
  DT_Reconhecimento: '2025-09-12T00:00:00.000Z',
  Valor_Reconhecimento: 15000,
  ID_User: 'dev',
  DT_User: '2025-09-12T00:00:00.000Z',
}

describe('HttpReconhecimentoRepository', () => {
  let repo: HttpReconhecimentoRepository
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    repo = new HttpReconhecimentoRepository()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('listByOrder', () => {
    it('GETs /orders/reconhecimentos?orderId=N and returns the mapped rows', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, rows: [row] }))

      const rows = await repo.listByOrder(1001)

      expect(rows).toEqual([row])
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0][0]).toBe('/api/orders/reconhecimentos?orderId=1001')
      const init = fetchMock.mock.calls[0][1] as RequestInit
      expect(init?.method).toBe('GET')
    })

    it('returns an empty list when the order has no reconhecimentos', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, rows: [] }))

      expect(await repo.listByOrder(99999)).toEqual([])
    })

    it('maps an orders-not-configured failure (502) to a server-error RepositoryError', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(502, { ok: false, code: 'orders-not-configured', message: 'No orders profile.' }),
      )

      const error = await repo.listByOrder(1001).catch((e) => e)
      expect(error).toBeInstanceOf(RepositoryError)
      expect(error).toMatchObject({ kind: 'server-error', message: 'No orders profile.' })
    })

    it('maps a 500 to a server-error RepositoryError', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(500, { ok: false, code: 'internal', message: 'boom' }))

      await expect(repo.listByOrder(1001)).rejects.toMatchObject({
        kind: 'server-error',
        message: 'boom',
      })
    })

    it('maps a 401 unauthorized to a forbidden RepositoryError', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(401, { ok: false, code: 'unauthorized', message: 'no token' }))

      await expect(repo.listByOrder(1001)).rejects.toMatchObject({
        kind: 'forbidden',
        message: 'no token',
      })
    })

    it('maps a 403 forbidden to a forbidden RepositoryError', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(403, { ok: false, code: 'forbidden', message: 'role not allowed.' }))

      await expect(repo.listByOrder(1001)).rejects.toMatchObject({
        kind: 'forbidden',
        message: 'role not allowed.',
      })
    })

    it('maps a network failure to a server-error RepositoryError', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network down'))

      await expect(repo.listByOrder(1001)).rejects.toMatchObject({ kind: 'server-error' })
    })

    it('falls back to a generic message when the body is not an ApiFailure', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(500, null))

      await expect(repo.listByOrder(1001)).rejects.toMatchObject({
        kind: 'server-error',
        message: 'The database service returned an unexpected error.',
      })
    })
  })

  describe('add', () => {
    it('posts a new recognition entry', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(201, { ok: true, row }))
      await expect(
        repo.add({
          ID_Order: 1001,
          ID_Tp_Reconhecimento: 'P',
          DT_Reconhecimento: '2025-09-12T00:00:00.000Z',
          Valor_Reconhecimento: 5000,
          ID_User: 'dev',
        }),
      ).resolves.toEqual(row)
      expect(fetchMock).toHaveBeenCalledOnce()
    })
  })
})
