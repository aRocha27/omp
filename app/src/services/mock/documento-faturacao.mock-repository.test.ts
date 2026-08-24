/**
 * Unit tests for MockDocumentoFaturacaoRepository.
 *
 * Direct instantiation — no React, no providers. Covers the `listByOrder` filter
 * semantics and the `add` append-and-persist path.
 */
import { describe, it, expect } from 'vitest'
import { MockDocumentoFaturacaoRepository } from '@/services/mock/documento-faturacao.mock-repository'
import { facturacao as fixtureRows } from '@/fixtures/facturacao'

describe('MockDocumentoFaturacaoRepository', () => {
  describe('listByOrder', () => {
    it('returns only the rows for the given order, ordered oldest-first', async () => {
      const repo = new MockDocumentoFaturacaoRepository()
      const rows = await repo.listByOrder(1002)
      const ids = rows.map((r) => r.ID_Facturacao)
      // Fixture rows for 1002: 3 (09-20), 4 (09-25), 5 (10-01) — oldest-first.
      expect(ids).toEqual([3, 4, 5])
    })

    it('returns an empty array for an order with no invoicing documents', async () => {
      const repo = new MockDocumentoFaturacaoRepository()
      const rows = await repo.listByOrder(1005)
      expect(rows).toEqual([])
    })

    it('returns an empty array for an unknown order id', async () => {
      const repo = new MockDocumentoFaturacaoRepository()
      const rows = await repo.listByOrder(99999)
      expect(rows).toEqual([])
    })

    it('returns defensive copies so callers cannot mutate internal state', async () => {
      const repo = new MockDocumentoFaturacaoRepository()
      const rows = await repo.listByOrder(1001)
      rows[0].Valor_Doc_FT = 0
      // Re-fetch must be unaffected by the caller's mutation.
      const fresh = await repo.listByOrder(1001)
      expect(fresh[0].Valor_Doc_FT).toBe(
        fixtureRows.find((r) => r.ID_Facturacao === 1)?.Valor_Doc_FT,
      )
    })
  })

  describe('add', () => {
    it('appends a new entry with a generated PK and audit columns', async () => {
      const repo = new MockDocumentoFaturacaoRepository()
      const before = await repo.listByOrder(1001)
      expect(before).toHaveLength(2)

      const created = await repo.add({
        ID_Order: 1001,
        ID_Tp_Doc_FT: 'FT',
        N_Doc_FT: 'FT 2025/0009',
        DT_Doc_FT: '2025-11-01T00:00:00Z',
        Valor_Doc_FT: 12000,
        ID_User: 'u_demo_a',
      })

      // PK is the next available id above the fixture max (5).
      expect(created.ID_Facturacao).toBe(6)
      // Audit user is honoured when provided; DT_User is assigned by the repo.
      expect(created.ID_User).toBe('u_demo_a')
      expect(created.DT_User).not.toBeNull()
    })

    it('defaults ID_User to "mock" when omitted', async () => {
      const repo = new MockDocumentoFaturacaoRepository()
      const created = await repo.add({
        ID_Order: 1003,
        ID_Tp_Doc_FT: 'FT',
        N_Doc_FT: 'FT 2025/0010',
        DT_Doc_FT: '2025-11-01T00:00:00Z',
        Valor_Doc_FT: 2000,
      })
      expect(created.ID_User).toBe('mock')
    })

    it('includes the new entry in subsequent listByOrder calls', async () => {
      const repo = new MockDocumentoFaturacaoRepository()
      await repo.add({
        ID_Order: 1001,
        ID_Tp_Doc_FT: 'FT',
        N_Doc_FT: 'FT 2025/0011',
        DT_Doc_FT: '2025-11-01T00:00:00Z',
        Valor_Doc_FT: 12000,
      })

      const rows = await repo.listByOrder(1001)
      expect(rows).toHaveLength(3)
      // The new entry sorts last because its DT_Doc_FT is the latest.
      expect(rows[2].Valor_Doc_FT).toBe(12000)
    })

    it('does not leak the new entry into other orders', async () => {
      const repo = new MockDocumentoFaturacaoRepository()
      await repo.add({
        ID_Order: 1001,
        ID_Tp_Doc_FT: 'FT',
        N_Doc_FT: 'FT 2025/0011',
        DT_Doc_FT: '2025-11-01T00:00:00Z',
        Valor_Doc_FT: 12000,
      })

      const other = await repo.listByOrder(1002)
      expect(other.map((r) => r.ID_Order)).toEqual([1002, 1002, 1002])
    })
  })
})