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
      }, 'editor')

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
      }, 'editor')
      expect(created.ID_User).toBe('mock')
    })

    it('includes the new entry in subsequent listByOrder calls', async () => {
      const repo = new MockReconhecimentoRepository()
      await repo.add({
        ID_Order: 1001,
        ID_Tp_Reconhecimento: 'P',
        DT_Reconhecimento: '2025-11-01T00:00:00Z',
        Valor_Reconhecimento: 5000,
      }, 'editor')

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
      }, 'editor')

      const other = await repo.listByOrder(1002)
      expect(other.map((r) => r.ID_Order)).toEqual([1002, 1002])
    })

    it('rejects additions that would exceed Sell Price and does not persist them', async () => {
      const repo = new MockReconhecimentoRepository()
      await expect(
        repo.add({
          ID_Order: 1002,
          ID_Tp_Reconhecimento: 'P',
          DT_Reconhecimento: '2025-11-01T00:00:00Z',
          Valor_Reconhecimento: 1,
        }, 'editor'),
      ).rejects.toMatchObject({
        kind: 'server-error',
        message: 'Total recognised cannot exceed the Sell Price.',
      })
      expect(await repo.listByOrder(1002)).toHaveLength(2)
    })

    it('rejects an unknown order and viewer mutations', async () => {
      const repo = new MockReconhecimentoRepository()
      const entry = {
        ID_Order: 99999,
        ID_Tp_Reconhecimento: 'P',
        DT_Reconhecimento: '2025-11-01T00:00:00Z',
        Valor_Reconhecimento: 1,
      }
      await expect(repo.add(entry, 'editor')).rejects.toMatchObject({ kind: 'not-found' })
      await expect(repo.add({ ...entry, ID_Order: 1004 }, 'viewer')).rejects.toMatchObject({
        kind: 'forbidden',
      })
    })
  })

  describe('update', () => {
    it('patches the editable fields and re-stamps the audit columns', async () => {
      const repo = new MockReconhecimentoRepository()
      const updated = await repo.update(1, {
        ID_Tp_Reconhecimento: 'T',
        Valor_Reconhecimento: 9999,
      }, 'editor')
      expect(updated.ID_Reconhecimento).toBe(1)
      expect(updated.ID_Tp_Reconhecimento).toBe('T')
      expect(updated.Valor_Reconhecimento).toBe(9999)
      expect(updated.ID_User).toBe('mock')
      expect(updated.DT_User).not.toBeNull()

      const rows = await repo.listByOrder(1001)
      expect(rows.find((r) => r.ID_Reconhecimento === 1)?.Valor_Reconhecimento).toBe(9999)
    })

    it('throws not-found for an unknown id', async () => {
      const repo = new MockReconhecimentoRepository()
      await expect(repo.update(99999, { Valor_Reconhecimento: 1 }, 'editor')).rejects.toMatchObject({
        kind: 'not-found',
      })
    })

    it('validates capacity excluding the row being edited and preserves it on failure', async () => {
      const repo = new MockReconhecimentoRepository()
      await expect(repo.update(4, { Valor_Reconhecimento: 125401 }, 'editor')).rejects.toMatchObject({
        kind: 'server-error',
        message: 'Total recognised cannot exceed the Sell Price.',
      })
      expect((await repo.listByOrder(1002)).find((row) => row.ID_Reconhecimento === 4))
        .toMatchObject({ Valor_Reconhecimento: 125400 })
    })
  })

  describe('remove', () => {
    it('hard-deletes the entry by PK', async () => {
      const repo = new MockReconhecimentoRepository()
      await repo.remove(1, 'editor')
      const rows = await repo.listByOrder(1001)
      expect(rows.map((r) => r.ID_Reconhecimento)).not.toContain(1)
      expect(rows).toHaveLength(2)
    })

    it('throws not-found for an unknown id', async () => {
      const repo = new MockReconhecimentoRepository()
      await expect(repo.remove(99999, 'editor')).rejects.toMatchObject({ kind: 'not-found' })
    })
  })

  describe('propagate', () => {
    it('warranty: generates (N_Anos − 1) × 12 WP lines starting 12 months after start', async () => {
      // Order 1001: Tipo_Warranty true, ID_Tp_Warranty 1 → 1 year → 0 lines.
      const repo = new MockReconhecimentoRepository()
      const lines = await repo.propagate(1001, { kind: 'warranty' }, 'editor')
      expect(lines).toHaveLength(0)
    })

    it('warranty: a 2-year warranty order generates 12 WP lines', async () => {
      // Order 1005: INSTR (warranty true), ID_Tp_Warranty 2 → (2−1)×12 = 12 lines,
      // Warranty_Reserve 37500 → 3125/mês, start = 2025-07-23 + 12 months = 2026-07.
      const repo = new MockReconhecimentoRepository()
      const lines = await repo.propagate(1005, { kind: 'warranty' }, 'editor')
      expect(lines).toHaveLength(12)
      expect(lines.every((l) => l.ID_Tp_Reconhecimento === 'WP')).toBe(true)
      expect(lines[0].DT_Reconhecimento).toContain('2026-07-01')
      expect(lines[0].Valor_Reconhecimento).toBe(3125)
      expect(lines.reduce((sum, line) => sum + (line.Valor_Reconhecimento ?? 0), 0))
        .toBe(37500)
    })

    it('warranty: rejects duplicate propagation when the reserve is already recognized', async () => {
      // Order 1002 already has a 6600 WP row, exactly consuming Warranty_Reserve.
      const repo = new MockReconhecimentoRepository()
      await expect(repo.propagate(1002, { kind: 'warranty' }, 'editor')).rejects.toMatchObject({
        kind: 'server-error',
        message: 'Total recognised cannot exceed the Sell Price.',
      })
      expect(await repo.listByOrder(1002)).toHaveLength(2)
    })

    it('warranty: returns no lines for a non-warranty order kind', async () => {
      const repo = new MockReconhecimentoRepository()
      const lines = await repo.propagate(1006, { kind: 'warranty' }, 'editor')
      expect(lines).toEqual([])
    })

    it('maintenance: returns no lines for a non-CM order kind', async () => {
      // Order 1006 has ID_Tipo null; 1001 is INSTR — neither is CM. The domain
      // guard returns [] before validating params, so no throw even with years
      // missing. CM line generation is covered in propagation.test.ts with a
      // CM literal.
      const repo = new MockReconhecimentoRepository()
      const lines = await repo.propagate(1001, {
        kind: 'maintenance',
        startDate: '2025-01-01',
        years: 1,
        recognitionDate: '2025-06-01',
      }, 'editor')
      expect(lines).toEqual([])
    })

    it('maintenance: catches elapsed installments up in the recognition month', async () => {
      // Order 1007 is a CM order with Sell_Price 12000 and no existing rows.
      const repo = new MockReconhecimentoRepository()
      const lines = await repo.propagate(
        1007,
        {
          kind: 'maintenance',
          startDate: '2026-01-15',
          years: 1,
          recognitionDate: '2026-06-25',
        },
        'editor',
      )

      expect(lines).toHaveLength(12)
      expect(lines.slice(0, 6).map((line) => line.DT_Reconhecimento)).toEqual(
        Array.from({ length: 6 }, () => '2026-06-01T00:00:00.000Z'),
      )
      expect(lines.slice(6).map((line) => line.DT_Reconhecimento)).toEqual([
        '2026-07-01T00:00:00.000Z',
        '2026-08-01T00:00:00.000Z',
        '2026-09-01T00:00:00.000Z',
        '2026-10-01T00:00:00.000Z',
        '2026-11-01T00:00:00.000Z',
        '2026-12-01T00:00:00.000Z',
      ])
      expect(
        lines.reduce((sum, line) => sum + (line.Valor_Reconhecimento ?? 0), 0),
      ).toBe(12000)
    })

    it('throws not-found for an unknown order', async () => {
      const repo = new MockReconhecimentoRepository()
      await expect(repo.propagate(99999, { kind: 'warranty' }, 'editor')).rejects.toMatchObject({
        kind: 'not-found',
      })
    })
  })
})