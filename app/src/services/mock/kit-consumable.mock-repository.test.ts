/**
 * Unit tests for MockKitConsumableRepository.
 *
 * Direct instantiation — no React, no providers. Covers the `listByOrder` filter
 * + ID_Kit ordering, and the add/update/remove paths (no capacity enforcement,
 * hard delete — dbo.Kit_Consumables has no audit columns or deleted_at).
 */
import { describe, it, expect } from 'vitest'
import { MockKitConsumableRepository } from '@/services/mock/kit-consumable.mock-repository'

describe('MockKitConsumableRepository', () => {
  describe('listByOrder', () => {
    it('returns only the rows for the given order, ordered by ID_Kit asc', async () => {
      const repo = new MockKitConsumableRepository()
      const rows = await repo.listByOrder(1005)
      // Fixture rows for 1005: ID_Kit 1, 2.
      expect(rows.map((r) => r.ID_Kit)).toEqual([1, 2])
      expect(rows.every((r) => r.ID_Order === 1005)).toBe(true)
    })

    it('returns an empty array for an order with no consumables', async () => {
      const repo = new MockKitConsumableRepository()
      const rows = await repo.listByOrder(1003)
      expect(rows).toEqual([])
    })

    it('returns defensive copies so callers cannot mutate internal state', async () => {
      const repo = new MockKitConsumableRepository()
      const rows = await repo.listByOrder(1005)
      rows[0].Total_Price = 0
      const fresh = await repo.listByOrder(1005)
      expect(fresh[0].Total_Price).toBe(250)
    })
  })

  describe('add', () => {
    it('appends a new entry with a generated PK and no audit columns', async () => {
      const repo = new MockKitConsumableRepository()
      const created = await repo.add(
        {
          ID_Order: 1005,
          Date: '2025-11-01T00:00:00Z',
          Internal_Order: 'INT-NEW',
          Material: 'MAT-NEW',
          Description: 'desc',
          Quant: 3,
          Unit_Price: 10,
          Total_Price: 30,
        },
        'editor',
      )
      // PK is the next available id above the fixture max (3).
      expect(created.ID_Kit).toBe(4)
      expect(created.ID_Order).toBe(1005)
      expect(created.Quant).toBe(3)
    })

    it('includes the new entry in subsequent listByOrder calls', async () => {
      const repo = new MockKitConsumableRepository()
      await repo.add(
        {
          ID_Order: 1005,
          Date: '2025-11-01T00:00:00Z',
          Internal_Order: 'INT-NEW',
          Material: 'MAT-NEW',
          Description: 'desc',
          Quant: 3,
          Unit_Price: 10,
          Total_Price: 30,
        },
        'editor',
      )
      const rows = await repo.listByOrder(1005)
      expect(rows).toHaveLength(3)
      expect(rows[2].ID_Kit).toBe(4)
    })

    it('does not leak the new entry into other orders', async () => {
      const repo = new MockKitConsumableRepository()
      await repo.add(
        {
          ID_Order: 1005,
          Date: '2025-11-01T00:00:00Z',
          Internal_Order: 'INT-NEW',
          Material: 'MAT-NEW',
          Description: 'desc',
          Quant: 3,
          Unit_Price: 10,
          Total_Price: 30,
        },
        'editor',
      )
      const other = await repo.listByOrder(1002)
      expect(other).toHaveLength(1)
    })

    it('rejects an unknown order and viewer mutations', async () => {
      const repo = new MockKitConsumableRepository()
      const entry = {
        ID_Order: 99999,
        Date: '2025-11-01T00:00:00Z',
        Internal_Order: 'INT-NEW',
        Material: 'MAT-NEW',
        Description: 'desc',
        Quant: 3,
        Unit_Price: 10,
        Total_Price: 30,
      }
      await expect(repo.add(entry, 'editor')).rejects.toMatchObject({ kind: 'not-found' })
      await expect(
        repo.add({ ...entry, ID_Order: 1005 }, 'viewer'),
      ).rejects.toMatchObject({ kind: 'forbidden' })
    })
  })

  describe('update', () => {
    it('patches the editable fields', async () => {
      const repo = new MockKitConsumableRepository()
      const updated = await repo.update(1, { Quant: 99, Total_Price: 9900 }, 'editor')
      expect(updated.ID_Kit).toBe(1)
      expect(updated.Quant).toBe(99)
      expect(updated.Total_Price).toBe(9900)
      const rows = await repo.listByOrder(1005)
      expect(rows.find((r) => r.ID_Kit === 1)?.Quant).toBe(99)
    })

    it('throws not-found for an unknown id', async () => {
      const repo = new MockKitConsumableRepository()
      await expect(repo.update(99999, { Quant: 1 }, 'editor')).rejects.toMatchObject({
        kind: 'not-found',
      })
    })

    it('rejects viewer mutations', async () => {
      const repo = new MockKitConsumableRepository()
      await expect(repo.update(1, { Quant: 1 }, 'viewer')).rejects.toMatchObject({
        kind: 'forbidden',
      })
    })
  })

  describe('remove', () => {
    it('hard-deletes the entry by PK', async () => {
      const repo = new MockKitConsumableRepository()
      await repo.remove(1, 'editor')
      const rows = await repo.listByOrder(1005)
      expect(rows.map((r) => r.ID_Kit)).not.toContain(1)
      expect(rows).toHaveLength(1)
    })

    it('throws not-found for an unknown id', async () => {
      const repo = new MockKitConsumableRepository()
      await expect(repo.remove(99999, 'editor')).rejects.toMatchObject({ kind: 'not-found' })
    })

    it('rejects viewer mutations', async () => {
      const repo = new MockKitConsumableRepository()
      await expect(repo.remove(1, 'viewer')).rejects.toMatchObject({ kind: 'forbidden' })
    })
  })
})