/**
 * Unit tests for MockReconhecimentoRepository.
 *
 * Direct instantiation — no React, no providers. Covers the `listByOrder` filter
 * semantics and the `add` append-and-persist path.
 */
import { describe, it, expect } from 'vitest'
import { MockReconhecimentoRepository } from '@/services/mock/reconhecimento.mock-repository'
import { reconhecimentos as fixtureRows } from '@/fixtures/reconhecimentos'

describe('MockReconhecimentoRepository', () => {
  describe('listByOrder', () => {
    it('returns only the rows for the given order, ordered oldest-first', async () => {
      const repo = new MockReconhecimentoRepository()
      const rows = await repo.listByOrder(1001)
      const ids = rows.map((r) => r.ID_Reconhecimento)
      // Fixture rows for 1001: 1 (09-20), 2 (09-25), 3 (10-10) — oldest-first.
      expect(ids).toEqual([1, 2, 3])
    })

    it('returns an empty array for an order with no recognitions', async () => {
      const repo = new MockReconhecimentoRepository()
      const rows = await repo.listByOrder(1003)
      expect(rows).toEqual([])
    })

    it('returns an empty array for an unknown order id', async () => {
      const repo = new MockReconhecimentoRepository()
      const rows = await repo.listByOrder(99999)
      expect(rows).toEqual([])
    })

    it('returns defensive copies so callers cannot mutate internal state', async () => {
      const repo = new MockReconhecimentoRepository()
      const rows = await repo.listByOrder(1001)
      rows[0].Valor_Reconhecimento = 0
      // Re-fetch must be unaffected by the caller's mutation.
      const fresh = await repo.listByOrder(1001)
      expect(fresh[0].Valor_Reconhecimento).toBe(
        fixtureRows.find((r) => r.ID_Reconhecimento === 1)?.Valor_Reconhecimento,
      )
    })
  })

  describe('add', () => {
    it('appends a new entry with a generated PK and audit columns', async () => {
      const repo = new MockReconhecimentoRepository()
      const before = await repo.listByOrder(1001)
      expect(before).toHaveLength(3)

      const created = await repo.add({
        ID_Order: 1001,
        ID_Tp_Reconhecimento: 'P',
        DT_Reconhecimento: '2025-11-01T00:00:00Z',
        Valor_Reconhecimento: 5000,
        ID_User: 'u_demo_a',
      })

      // PK is the next available id above the fixture max (7).
      expect(created.ID_Reconhecimento).toBe(8)
      // Audit user is honoured when provided; DT_User is assigned by the repo.
      expect(created.ID_User).toBe('u_demo_a')
      expect(created.DT_User).not.toBeNull()
    })

    it('defaults ID_User to "mock" when omitted', async () => {
      const repo = new MockReconhecimentoRepository()
      const created = await repo.add({
        ID_Order: 1004,
        ID_Tp_Reconhecimento: 'P',
        DT_Reconhecimento: '2025-11-01T00:00:00Z',
        Valor_Reconhecimento: 1000,
      })
      expect(created.ID_User).toBe('mock')
    })

    it('includes the new entry in subsequent listByOrder calls', async () => {
      const repo = new MockReconhecimentoRepository()
      await repo.add({
        ID_Order: 1001,
        ID_Tp_Reconhecimento: 'P',
        DT_Reconhecimento: '2025-11-01T00:00:00Z',
        Valor_Reconhecimento: 5000,
      })

      const rows = await repo.listByOrder(1001)
      expect(rows).toHaveLength(4)
      // The new entry sorts last because its DT_Reconhecimento is the latest.
      expect(rows[3].Valor_Reconhecimento).toBe(5000)
    })

    it('does not leak the new entry into other orders', async () => {
      const repo = new MockReconhecimentoRepository()
      await repo.add({
        ID_Order: 1001,
        ID_Tp_Reconhecimento: 'P',
        DT_Reconhecimento: '2025-11-01T00:00:00Z',
        Valor_Reconhecimento: 5000,
      })

      const other = await repo.listByOrder(1002)
      expect(other.map((r) => r.ID_Order)).toEqual([1002, 1002])
    })
  })
})