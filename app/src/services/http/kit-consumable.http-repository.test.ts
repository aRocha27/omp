/**
 * Unit tests for HttpKitConsumableRepository.
 *
 * Global `fetch` is mocked — no network. Mirrors the reconhecimento http-repository
 * tests: covers the live read and write endpoints, and the failure → RepositoryError
 * mapping (401/403 → forbidden, 404 → not-found, 500 → server-error, network →
 * server-error).
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { HttpKitConsumableRepository } from '@/services/http/kit-consumable.http-repository'
import { RepositoryError } from '@/services/contracts/kit-consumable.repository'
import type { KitConsumable } from '@/domain/models/kit-consumable'

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

const row: KitConsumable = {
  ID_Kit: 11,
  ID_Order: 1005,
  Date: '2025-09-12T00:00:00.000Z',
  Internal_Order: 'INT-A',
  Material: 'MAT-A',
  Description: 'desc',
  Quant: 5,
  Unit_Price: 50,
  Total_Price: 250,
}

describe('HttpKitConsumableRepository', () => {
  let repo: HttpKitConsumableRepository
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    repo = new HttpKitConsumableRepository()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('listByOrder', () => {
    it('GETs /orders/kit-consumables?orderId=N and returns the mapped rows', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, rows: [row] }))

      const rows = await repo.listByOrder(1005)

      expect(rows).toEqual([row])
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0][0]).toBe('/api/orders/kit-consumables?orderId=1005')
      const init = fetchMock.mock.calls[0][1] as RequestInit
      expect(init?.method).toBe('GET')
    })

    it('returns an empty list when the order has no consumables', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, rows: [] }))
      expect(await repo.listByOrder(99999)).toEqual([])
    })

    it('maps a 500 to a server-error RepositoryError', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(500, { ok: false, code: 'internal', message: 'boom' }))
      await expect(repo.listByOrder(1005)).rejects.toMatchObject({
        kind: 'server-error',
        message: 'boom',
      })
    })

    it('maps a 403 forbidden to a forbidden RepositoryError', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(403, { ok: false, code: 'forbidden', message: 'role not allowed.' }))
      await expect(repo.listByOrder(1005)).rejects.toMatchObject({
        kind: 'forbidden',
        message: 'role not allowed.',
      })
    })

    it('maps a network failure to a server-error RepositoryError', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network down'))
      await expect(repo.listByOrder(1005)).rejects.toMatchObject({ kind: 'server-error' })
    })
  })

  describe('add', () => {
    it('posts a new kit consumable entry', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(201, { ok: true, row }))
      await expect(
        repo.add(
          {
            ID_Order: 1005,
            Date: '2025-09-12T00:00:00.000Z',
            Internal_Order: 'INT-A',
            Material: 'MAT-A',
            Description: 'desc',
            Quant: 5,
            Unit_Price: 50,
            Total_Price: 250,
          },
          'editor',
        ),
      ).resolves.toEqual(row)
      const init = fetchMock.mock.calls[0][1] as RequestInit
      expect(init?.method).toBe('POST')
      expect(init?.headers).toMatchObject({ 'X-User-Role': 'editor' })
    })

    it('maps a 403 to a forbidden RepositoryError', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(403, { ok: false, code: 'forbidden', message: 'no' }))
      await expect(
        repo.add(
          {
            ID_Order: 1005,
            Date: '2025-09-12T00:00:00.000Z',
            Internal_Order: 'INT-A',
            Material: 'MAT-A',
            Description: 'desc',
            Quant: 5,
            Unit_Price: 50,
            Total_Price: 250,
          },
          'viewer',
        ),
      ).rejects.toBeInstanceOf(RepositoryError)
    })
  })

  describe('update', () => {
    it('POSTs {id, patch} to /orders/kit-consumables/update and returns the row', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, row }))
      await expect(repo.update(11, { Quant: 9 }, 'editor')).resolves.toEqual(row)
      const init = fetchMock.mock.calls[0][1] as RequestInit
      expect(init?.method).toBe('POST')
      expect(init?.body).toBe(JSON.stringify({ id: 11, patch: { Quant: 9 } }))
    })
  })

  describe('remove', () => {
    it('POSTs {id} to /orders/kit-consumables/delete and resolves', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }))
      await expect(repo.remove(11, 'editor')).resolves.toBeUndefined()
      const init = fetchMock.mock.calls[0][1] as RequestInit
      expect(init?.body).toBe(JSON.stringify({ id: 11 }))
    })
  })
})