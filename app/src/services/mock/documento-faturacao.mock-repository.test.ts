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
  describe('listTypes', () => {
    it('returns the Tp_Doc_FT options used by mock mode', async () => {
      const repo = new MockDocumentoFaturacaoRepository()
      await expect(repo.listTypes()).resolves.toEqual([
        { id: 'AcFT', label: 'Invoice Adjustment' },
        { id: 'FT', label: 'Invoice' },
        { id: 'NC', label: 'Credit Note' },
      ])
    })
  })

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
      }, 'editor')

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
      }, 'editor')
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
      }, 'editor')

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
      }, 'editor')

      const other = await repo.listByOrder(1002)
      expect(other.map((r) => r.ID_Order)).toEqual([1002, 1002, 1002])
    })

    it('rejects additions whose net would exceed Sell Price without persisting them', async () => {
      const repo = new MockDocumentoFaturacaoRepository()
      await expect(
        repo.add({
          ID_Order: 1002,
          ID_Tp_Doc_FT: 'FT',
          N_Doc_FT: 'FT over limit',
          DT_Doc_FT: '2025-11-01T00:00:00Z',
          Valor_Doc_FT: 4000,
        }, 'editor'),
      ).rejects.toMatchObject({
        kind: 'server-error',
        message: 'Net invoiced cannot exceed the Sell Price.',
      })
      expect(await repo.listByOrder(1002)).toHaveLength(3)
    })

    it('rejects unknown orders and viewer mutations', async () => {
      const repo = new MockDocumentoFaturacaoRepository()
      const entry = {
        ID_Order: 99999,
        ID_Tp_Doc_FT: 'FT',
        N_Doc_FT: 'FT unknown',
        DT_Doc_FT: '2025-11-01T00:00:00Z',
        Valor_Doc_FT: 1,
      }
      await expect(repo.add(entry, 'editor')).rejects.toMatchObject({ kind: 'not-found' })
      await expect(repo.add({ ...entry, ID_Order: 1003 }, 'viewer')).rejects.toMatchObject({
        kind: 'forbidden',
      })
    })
  })

  describe('update', () => {
    it('patches the editable fields and re-stamps the audit columns', async () => {
      const repo = new MockDocumentoFaturacaoRepository()
      const updated = await repo.update(1, {
        ID_Tp_Doc_FT: 'NC',
        Valor_Doc_FT: 4321,
      }, 'editor')
      expect(updated.ID_Facturacao).toBe(1)
      expect(updated.ID_Tp_Doc_FT).toBe('NC')
      expect(updated.Valor_Doc_FT).toBe(4321)
      expect(updated.ID_User).toBe('mock')
      expect(updated.DT_User).not.toBeNull()

      const rows = await repo.listByOrder(1001)
      expect(rows.find((r) => r.ID_Facturacao === 1)?.Valor_Doc_FT).toBe(4321)
    })

    it('throws not-found for an unknown id', async () => {
      const repo = new MockDocumentoFaturacaoRepository()
      await expect(repo.update(99999, { Valor_Doc_FT: 1 }, 'editor')).rejects.toMatchObject({
        kind: 'not-found',
      })
    })

    it('validates net capacity excluding the edited row and preserves it on failure', async () => {
      const repo = new MockDocumentoFaturacaoRepository()
      await expect(repo.update(3, { Valor_Doc_FT: 70000 }, 'editor')).rejects.toMatchObject({
        kind: 'server-error',
        message: 'Net invoiced cannot exceed the Sell Price.',
      })
      expect((await repo.listByOrder(1002)).find((row) => row.ID_Facturacao === 3))
        .toMatchObject({ Valor_Doc_FT: 66000 })
    })
  })

  describe('remove', () => {
    it('hard-deletes the entry by PK', async () => {
      const repo = new MockDocumentoFaturacaoRepository()
      await repo.remove(1, 'editor')
      const rows = await repo.listByOrder(1001)
      expect(rows.map((r) => r.ID_Facturacao)).not.toContain(1)
      expect(rows).toHaveLength(1)
    })

    it('throws not-found for an unknown id', async () => {
      const repo = new MockDocumentoFaturacaoRepository()
      await expect(repo.remove(99999, 'editor')).rejects.toMatchObject({ kind: 'not-found' })
    })
  })
})